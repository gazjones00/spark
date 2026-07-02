import { Injectable } from "@nestjs/common";
import type { ConnectorSyncResult } from "@spark/connectors";
import { and, eq, inArray, sql, type Database } from "@spark/db";
import {
  accountDailyBalances,
  financialTransactions,
  transactionDailyRollups,
} from "@spark/db/schema";

type RollupDb = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Distinct UTC days per account external id. */
export type RollupBuckets = Map<string, Set<string>>;

export interface RefreshRollupsInput {
  userId: string;
  connectionId: string;
  transactions: ConnectorSyncResult["transactions"];
  /**
   * Buckets the batch's rows occupied BEFORE the upsert (see
   * {@link TransactionRollupService.captureExistingBuckets}). Without them an
   * update that moves a transaction to a different day would leave the old
   * day's bucket stale — the new batch only names the new day.
   */
  previousBuckets?: RollupBuckets;
}

/**
 * Maintains the incremental dashboard aggregates (`transaction_daily_rollups`
 * and `account_daily_balances`) for the buckets a sync batch touches.
 *
 * Buckets are RECOMPUTED from the base `financial_transactions` rows — never
 * incremented — because the sync path updates existing transactions on
 * conflict (amount, category, even the day can move), so `+= amount`
 * maintenance would drift. Delete-then-insert also converges when an update
 * empties a bucket entirely: the stale row disappears instead of lingering.
 *
 * Must run inside the same transaction as the transaction upserts so the
 * aggregates can never be observed out of step with the base rows.
 */
@Injectable()
export class TransactionRollupService {
  /**
   * Reads the (account, day) buckets the batch's rows currently sit in.
   * MUST run before the transaction upserts: the upsert overwrites
   * `occurred_at`, destroying the only record of a moved transaction's old
   * day. Same transaction as the upsert, so the read is consistent.
   */
  async captureExistingBuckets(
    db: RollupDb,
    connectionId: string,
    transactions: ConnectorSyncResult["transactions"],
  ): Promise<RollupBuckets> {
    const buckets: RollupBuckets = new Map();
    if (transactions.length === 0) {
      return buckets;
    }

    const rows = await db
      .select({
        accountExternalId: financialTransactions.accountExternalId,
        occurredAt: financialTransactions.occurredAt,
      })
      .from(financialTransactions)
      .where(
        and(
          eq(financialTransactions.connectionId, connectionId),
          inArray(
            financialTransactions.externalId,
            transactions.map((transaction) => transaction.externalId),
          ),
        ),
      );

    for (const row of rows) {
      addBucket(buckets, row.accountExternalId, row.occurredAt.toISOString().slice(0, 10));
    }
    return buckets;
  }

  async refreshForBatch(db: RollupDb, input: RefreshRollupsInput): Promise<void> {
    const daysByAccount = groupTouchedDaysByAccount(input.transactions);
    for (const [accountExternalId, days] of input.previousBuckets ?? []) {
      for (const day of days) {
        addBucket(daysByAccount, accountExternalId, day);
      }
    }
    for (const [accountExternalId, days] of daysByAccount) {
      await this.recomputeBuckets(db, input, accountExternalId, [...days].sort());
    }
  }

  /**
   * Recomputes every affected (account, day) bucket from base rows for one
   * account. All aggregation happens in SQL over the `numeric` column — no
   * float accumulation.
   */
  private async recomputeBuckets(
    db: RollupDb,
    input: RefreshRollupsInput,
    accountExternalId: string,
    days: string[],
  ): Promise<void> {
    await db
      .delete(transactionDailyRollups)
      .where(
        and(
          eq(transactionDailyRollups.connectionId, input.connectionId),
          eq(transactionDailyRollups.accountExternalId, accountExternalId),
          inArray(transactionDailyRollups.day, days),
        ),
      );

    // Amounts are stored unsigned by the TrueLayer mappers, but abs() keeps
    // the totals correct for any provider that signs them.
    await db.execute(sql`
      INSERT INTO transaction_daily_rollups (
        id, user_id, connection_id, account_external_id, provider_id,
        day, currency, category, debit_total, credit_total, transaction_count, updated_at
      )
      SELECT
        gen_random_uuid(),
        ${input.userId},
        connection_id,
        account_external_id,
        provider_id,
        (occurred_at AT TIME ZONE 'UTC')::date,
        currency,
        coalesce(metadata->>'transactionCategory', 'UNKNOWN'),
        coalesce(sum(abs(amount)) FILTER (
          WHERE coalesce(metadata->>'truelayerTransactionType', 'DEBIT') = 'DEBIT'
        ), 0),
        coalesce(sum(abs(amount)) FILTER (
          WHERE metadata->>'truelayerTransactionType' = 'CREDIT'
        ), 0),
        count(*)::int,
        now()
      FROM financial_transactions
      WHERE connection_id = ${input.connectionId}
        AND account_external_id = ${accountExternalId}
        AND (occurred_at AT TIME ZONE 'UTC')::date = ANY(${sql.param(days)}::date[])
      GROUP BY
        connection_id,
        account_external_id,
        provider_id,
        (occurred_at AT TIME ZONE 'UTC')::date,
        currency,
        coalesce(metadata->>'transactionCategory', 'UNKNOWN')
    `);

    await db
      .delete(accountDailyBalances)
      .where(
        and(
          eq(accountDailyBalances.connectionId, input.connectionId),
          eq(accountDailyBalances.accountExternalId, accountExternalId),
          inArray(accountDailyBalances.day, days),
        ),
      );

    // End-of-day balance = runningBalance of the day's latest transaction;
    // days whose transactions all lack a running balance get no row and are
    // carried forward by the reader.
    await db.execute(sql`
      INSERT INTO account_daily_balances (
        id, user_id, connection_id, account_external_id, provider_id,
        day, currency, end_of_day_balance, observed_at, updated_at
      )
      SELECT DISTINCT ON (account_external_id, (occurred_at AT TIME ZONE 'UTC')::date)
        gen_random_uuid(),
        ${input.userId},
        connection_id,
        account_external_id,
        provider_id,
        (occurred_at AT TIME ZONE 'UTC')::date,
        currency,
        (metadata->'runningBalance'->>'amount')::numeric,
        occurred_at,
        now()
      FROM financial_transactions
      WHERE connection_id = ${input.connectionId}
        AND account_external_id = ${accountExternalId}
        AND (occurred_at AT TIME ZONE 'UTC')::date = ANY(${sql.param(days)}::date[])
        AND metadata->'runningBalance'->>'amount' IS NOT NULL
      ORDER BY
        account_external_id,
        (occurred_at AT TIME ZONE 'UTC')::date,
        occurred_at DESC,
        id DESC
    `);
  }
}

/** Distinct UTC days touched per account, derived from the sync batch. */
function groupTouchedDaysByAccount(
  transactions: ConnectorSyncResult["transactions"],
): RollupBuckets {
  const result: RollupBuckets = new Map();
  for (const transaction of transactions) {
    const occurredAt = new Date(transaction.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) {
      continue;
    }
    addBucket(result, transaction.accountExternalId, occurredAt.toISOString().slice(0, 10));
  }
  return result;
}

function addBucket(buckets: RollupBuckets, accountExternalId: string, day: string): void {
  const days = buckets.get(accountExternalId);
  if (days) {
    days.add(day);
  } else {
    buckets.set(accountExternalId, new Set([day]));
  }
}
