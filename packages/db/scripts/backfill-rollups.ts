/**
 * One-off backfill for the dashboard aggregate tables
 * (transaction_daily_rollups + account_daily_balances) over existing
 * financial_transactions history.
 *
 * Processes one connection per transaction: wipes that connection's rollup
 * rows and recomputes every bucket from base rows with the same SQL the sync
 * path uses incrementally (see apps/server TransactionRollupService — keep
 * the two in step if the aggregation rules change). Recomputation is the
 * invariant, so re-running the script always converges to the same values.
 *
 * Usage: bun run db:backfill:rollups
 * Requires DATABASE_URL.
 */

import { eq, sql } from "drizzle-orm";
import { db } from "../src/client.ts";
import {
  accountDailyBalances,
  connectorConnections,
  transactionDailyRollups,
} from "../src/schema/index.ts";

async function backfillConnection(connectionId: string, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .delete(transactionDailyRollups)
      .where(eq(transactionDailyRollups.connectionId, connectionId));

    await tx.execute(sql`
      INSERT INTO transaction_daily_rollups (
        id, user_id, connection_id, account_external_id, provider_id,
        day, currency, category, debit_total, credit_total, transaction_count, updated_at
      )
      SELECT
        gen_random_uuid(),
        ${userId},
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
      WHERE connection_id = ${connectionId}
      GROUP BY
        connection_id,
        account_external_id,
        provider_id,
        (occurred_at AT TIME ZONE 'UTC')::date,
        currency,
        coalesce(metadata->>'transactionCategory', 'UNKNOWN')
    `);

    await tx
      .delete(accountDailyBalances)
      .where(eq(accountDailyBalances.connectionId, connectionId));

    await tx.execute(sql`
      INSERT INTO account_daily_balances (
        id, user_id, connection_id, account_external_id, provider_id,
        day, currency, end_of_day_balance, observed_at, updated_at
      )
      SELECT DISTINCT ON (account_external_id, (occurred_at AT TIME ZONE 'UTC')::date)
        gen_random_uuid(),
        ${userId},
        connection_id,
        account_external_id,
        provider_id,
        (occurred_at AT TIME ZONE 'UTC')::date,
        currency,
        (metadata->'runningBalance'->>'amount')::numeric,
        occurred_at,
        now()
      FROM financial_transactions
      WHERE connection_id = ${connectionId}
        AND metadata->'runningBalance'->>'amount' IS NOT NULL
      ORDER BY
        account_external_id,
        (occurred_at AT TIME ZONE 'UTC')::date,
        occurred_at DESC,
        id DESC
    `);
  });
}

async function main(): Promise<void> {
  const connections = await db
    .select({ id: connectorConnections.id, userId: connectorConnections.userId })
    .from(connectorConnections)
    .orderBy(connectorConnections.createdAt);

  console.log(`Backfilling rollups for ${connections.length} connection(s)`);
  for (const connection of connections) {
    await backfillConnection(connection.id, connection.userId);
    console.log(`  ✓ ${connection.id}`);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error("Rollup backfill failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
