import { Injectable } from "@nestjs/common";
import type { ConnectorSyncResult } from "@spark/connectors";
import { and, eq, inArray, sql, type DatabaseExecutor } from "@spark/db";
import { accountDailyBalances, financialTransactions } from "@spark/db/schema";

/** Distinct UTC days per account external id. */
export type DayBuckets = Map<string, Set<string>>;

export interface RefreshDailyBalancesInput {
  userId: string;
  connectionId: string;
  transactions: ConnectorSyncResult["transactions"];
  /**
   * Buckets the batch's rows occupied BEFORE the upsert (see
   * {@link DailyBalanceService.captureExistingBuckets}). Without them an
   * update that moves a transaction to a different day would leave the old
   * day's balance row stale — the new batch only names the new day.
   */
  previousBuckets?: DayBuckets;
}

/**
 * Maintains the `account_daily_balances` read model (the balance-series
 * source) for the (account, day) buckets a sync batch touches.
 *
 * Buckets are RECOMPUTED from the base `financial_transactions` rows — never
 * incremented — because the sync path updates existing transactions on
 * conflict (amount, even the day can move), so incremental maintenance would
 * drift. Delete-then-insert also converges when an update empties a bucket
 * entirely: the stale row disappears instead of lingering.
 *
 * Must run inside the same transaction as the transaction upserts so the
 * balance rows can never be observed out of step with the base rows.
 */
@Injectable()
export class DailyBalanceService {
  /**
   * Reads the (account, day) buckets the batch's rows currently sit in.
   * MUST run before the transaction upserts: the upsert overwrites
   * `occurred_at`, destroying the only record of a moved transaction's old
   * day. Same transaction as the upsert, so the read is consistent.
   */
  async captureExistingBuckets(
    db: DatabaseExecutor,
    connectionId: string,
    transactions: ConnectorSyncResult["transactions"],
  ): Promise<DayBuckets> {
    const buckets: DayBuckets = new Map();
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

  async refreshForBatch(db: DatabaseExecutor, input: RefreshDailyBalancesInput): Promise<void> {
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
   * Recomputes every affected (account, day) balance row from base rows for
   * one account.
   */
  private async recomputeBuckets(
    db: DatabaseExecutor,
    input: RefreshDailyBalancesInput,
    accountExternalId: string,
    days: string[],
  ): Promise<void> {
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
function groupTouchedDaysByAccount(transactions: ConnectorSyncResult["transactions"]): DayBuckets {
  const result: DayBuckets = new Map();
  for (const transaction of transactions) {
    const occurredAt = new Date(transaction.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) {
      continue;
    }
    addBucket(result, transaction.accountExternalId, occurredAt.toISOString().slice(0, 10));
  }
  return result;
}

function addBucket(buckets: DayBuckets, accountExternalId: string, day: string): void {
  const days = buckets.get(accountExternalId);
  if (days) {
    days.add(day);
  } else {
    buckets.set(accountExternalId, new Set([day]));
  }
}
