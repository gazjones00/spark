import { Injectable } from "@nestjs/common";
import type { ConnectorSyncResult } from "@spark/connectors";
import { and, eq, inArray, sql, type Database } from "@spark/db";
import { accountDailyBalances, transactionDailyRollups } from "@spark/db/schema";

type RollupDb = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

export interface RefreshRollupsInput {
  userId: string;
  connectionId: string;
  transactions: ConnectorSyncResult["transactions"];
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
  async refreshForBatch(db: RollupDb, input: RefreshRollupsInput): Promise<void> {
    const daysByAccount = groupTouchedDaysByAccount(input.transactions);
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
        AND (occurred_at AT TIME ZONE 'UTC')::date = ANY(${days}::date[])
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
        AND (occurred_at AT TIME ZONE 'UTC')::date = ANY(${days}::date[])
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
): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  for (const transaction of transactions) {
    const occurredAt = new Date(transaction.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) {
      continue;
    }
    const day = occurredAt.toISOString().slice(0, 10);
    const days = result.get(transaction.accountExternalId);
    if (days) {
      days.add(day);
    } else {
      result.set(transaction.accountExternalId, new Set([day]));
    }
  }
  return result;
}
