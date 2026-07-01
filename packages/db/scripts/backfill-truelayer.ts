/**
 * TASK-005 backfill: copies the bespoke truelayer_* tables into the canonical
 * connector tables and parks the bespoke rows so exactly one scheduler owns
 * each connection (docs/adr/0001).
 *
 * Per truelayer_connections row (one transaction each):
 *   1. connector_connections row (same id; tokens re-encrypted as the
 *      connector-standard JSON credential record).
 *   2. financial_accounts rows via the TrueLayer connector mappers (same ids
 *      as the truelayer_accounts rows so client-visible ids stay stable).
 *   3. financial_transactions rows (same ids as truelayer_transactions).
 *   4. One balance_snapshots row per account with a stored balance.
 *   5. connector_sync_cursors checkpoints from lastSyncedAt so incremental
 *      windows continue where the bespoke path stopped.
 *   6. Reconciliation (counts must match) — mismatch aborts the transaction.
 *   7. Parks truelayer_accounts (syncStatus = MIGRATED) so PeriodicSyncJob
 *      stops selecting them (NFR-4: no double-sync).
 *
 * Idempotent: canonical writes use onConflictDoNothing against the unique
 * indexes, and already-migrated connections are skipped. Rollback: un-park
 * the truelayer_accounts rows and delete the created connector_connections
 * rows (children cascade); bespoke data is never modified beyond the parking
 * flag.
 *
 * Usage: bun run db:backfill:truelayer   (requires DATABASE_URL + ENCRYPTION_KEY)
 */

import {
  mapTrueLayerAccount,
  mapTrueLayerTransaction,
  transactionsResource,
  TRUELAYER_MANIFEST,
  truelayerAccountExternalId,
} from "@spark/connectors";
import type { Transaction, TrueLayerAccount } from "@spark/schema";
import { SyncStatus } from "@spark/common";
import { decryptFromString, encryptToString } from "@spark/crypto";
import { env } from "@spark/env/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../src/client.ts";
import {
  balanceSnapshots,
  connectorConnections,
  connectorSyncCursors,
  financialAccounts,
  financialTransactions,
  truelayerAccounts,
  truelayerConnections,
  truelayerTransactions,
} from "../src/schema/index.ts";

const CHUNK_SIZE = 500;

type TruelayerConnectionRow = typeof truelayerConnections.$inferSelect;
type TruelayerAccountRow = typeof truelayerAccounts.$inferSelect;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function toTrueLayerAccount(row: TruelayerAccountRow): TrueLayerAccount {
  return {
    updateTimestamp: row.updateTimestamp.toISOString(),
    accountId: row.accountId,
    ...(row.accountType ? { accountType: row.accountType } : {}),
    displayName: row.displayName,
    currency: row.currency,
    accountNumber: row.accountNumber,
    provider: row.provider,
  };
}

async function migrateConnection(connection: TruelayerConnectionRow): Promise<void> {
  const accounts = await db
    .select()
    .from(truelayerAccounts)
    .where(eq(truelayerAccounts.connectionId, connection.id));

  const activeAccounts = accounts.filter((account) => account.syncStatus !== SyncStatus.MIGRATED);
  if (accounts.length > 0 && activeAccounts.length === 0) {
    console.log(`~ connection ${connection.id}: already parked, skipping`);
    return;
  }

  const accountIds = accounts.map((account) => account.accountId);
  const transactions =
    accountIds.length > 0
      ? await db
          .select()
          .from(truelayerTransactions)
          .where(inArray(truelayerTransactions.accountId, accountIds))
      : [];

  // Re-encrypt the bespoke token pair as the connector credential record.
  const accessToken = await decryptFromString(connection.encryptedAccessToken, env.ENCRYPTION_KEY);
  const refreshToken = connection.encryptedRefreshToken
    ? await decryptFromString(connection.encryptedRefreshToken, env.ENCRYPTION_KEY)
    : null;
  const credentialRecord = {
    accessToken,
    ...(refreshToken ? { refreshToken } : {}),
    expiresAt: connection.expiresAt.toISOString(),
  };
  const encryptedCredentials = await encryptToString(
    JSON.stringify(credentialRecord),
    env.ENCRYPTION_KEY,
  );

  const hasNeedsReauth = accounts.some((account) => account.syncStatus === SyncStatus.NEEDS_REAUTH);
  const lastSyncedAt = accounts.reduce<Date | null>(
    (latest, account) =>
      account.lastSyncedAt && (!latest || account.lastSyncedAt > latest)
        ? account.lastSyncedAt
        : latest,
    null,
  );

  await db.transaction(async (tx) => {
    const now = new Date();

    await tx
      .insert(connectorConnections)
      .values({
        id: connection.id,
        userId: connection.userId,
        providerId: TRUELAYER_MANIFEST.id,
        providerName: TRUELAYER_MANIFEST.displayName,
        environment: env.TRUELAYER_ENV,
        encryptedCredentials,
        credentialKeyId: connection.tokenKeyId,
        capabilities: [...TRUELAYER_MANIFEST.capabilities],
        metadata: { accountIds, migratedAt: now.toISOString() },
        syncStatus: hasNeedsReauth ? SyncStatus.NEEDS_REAUTH : SyncStatus.OK,
        lastSyncedAt,
        nextSyncAt: now,
        createdAt: connection.createdAt,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: connectorConnections.id });

    for (const account of accounts) {
      const mapped = mapTrueLayerAccount(toTrueLayerAccount(account));
      await tx
        .insert(financialAccounts)
        .values({
          id: account.id,
          connectionId: connection.id,
          userId: connection.userId,
          providerId: mapped.providerId,
          externalId: mapped.externalId,
          type: mapped.type,
          displayName: mapped.displayName,
          currency: mapped.currency,
          metadata: mapped.metadata,
          createdAt: account.createdAt,
          updatedAt: now,
        })
        .onConflictDoNothing({
          target: [financialAccounts.connectionId, financialAccounts.externalId],
        });

      if (account.currentBalance && account.balanceUpdatedAt) {
        await tx
          .insert(balanceSnapshots)
          .values({
            id: crypto.randomUUID(),
            connectionId: connection.id,
            accountExternalId: truelayerAccountExternalId(account.accountId),
            providerId: mapped.providerId,
            currency: account.currency,
            cash: account.currentBalance,
            availableCash: account.availableBalance,
            blockedCash: null,
            invested: null,
            total: account.currentBalance,
            observedAt: account.balanceUpdatedAt,
            metadata: { overdraft: account.overdraft, source: "backfill" },
          })
          .onConflictDoNothing({
            target: [
              balanceSnapshots.connectionId,
              balanceSnapshots.accountExternalId,
              balanceSnapshots.observedAt,
            ],
          });
      }

      if (account.lastSyncedAt) {
        await tx
          .insert(connectorSyncCursors)
          .values({
            id: crypto.randomUUID(),
            connectionId: connection.id,
            resource: transactionsResource(account.accountId),
            cursor: null,
            checkpoint: account.lastSyncedAt.toISOString(),
            metadata: { source: "backfill" },
            updatedAt: now,
          })
          .onConflictDoNothing({
            target: [connectorSyncCursors.connectionId, connectorSyncCursors.resource],
          });
      }
    }

    for (const batch of chunk(transactions, CHUNK_SIZE)) {
      await tx
        .insert(financialTransactions)
        .values(
          batch.map((row) => {
            const transaction: Transaction = {
              transactionId: row.transactionId,
              ...(row.normalisedProviderTransactionId
                ? { normalisedProviderTransactionId: row.normalisedProviderTransactionId }
                : {}),
              ...(row.providerTransactionId
                ? { providerTransactionId: row.providerTransactionId }
                : {}),
              timestamp: row.timestamp.toISOString(),
              description: row.description,
              amount: row.amount,
              currency: row.currency,
              transactionType: row.transactionType,
              transactionCategory: row.transactionCategory,
              transactionClassification: row.transactionClassification,
              ...(row.merchantName ? { merchantName: row.merchantName } : {}),
              ...(row.runningBalance ? { runningBalance: row.runningBalance } : {}),
              ...(row.meta ? { meta: row.meta } : {}),
            };
            const mapped = mapTrueLayerTransaction(row.accountId, transaction);
            return {
              id: row.id,
              connectionId: connection.id,
              accountExternalId: mapped.accountExternalId,
              providerId: mapped.providerId,
              externalId: mapped.externalId,
              type: mapped.type,
              status: mapped.status,
              occurredAt: row.timestamp,
              settledAt: row.timestamp,
              description: mapped.description,
              amount: mapped.amount,
              currency: mapped.currency,
              instrumentExternalId: null,
              quantity: null,
              price: null,
              fees: null,
              tax: null,
              fxRate: null,
              metadata: mapped.metadata,
              createdAt: row.createdAt,
              updatedAt: now,
            };
          }),
        )
        .onConflictDoNothing({
          target: [financialTransactions.connectionId, financialTransactions.externalId],
        });
    }

    // Reconcile before parking: canonical row counts must cover the source.
    const [accountCount] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(financialAccounts)
      .where(eq(financialAccounts.connectionId, connection.id));
    const [transactionCount] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(financialTransactions)
      .where(eq(financialTransactions.connectionId, connection.id));

    if ((accountCount?.count ?? 0) < accounts.length) {
      throw new Error(
        `Reconciliation failed for connection ${connection.id}: ` +
          `${accountCount?.count ?? 0} financial_accounts < ${accounts.length} truelayer_accounts`,
      );
    }
    const distinctSourceTransactions = new Set(transactions.map((row) => `${row.transactionId}`))
      .size;
    if ((transactionCount?.count ?? 0) < distinctSourceTransactions) {
      throw new Error(
        `Reconciliation failed for connection ${connection.id}: ` +
          `${transactionCount?.count ?? 0} financial_transactions < ${distinctSourceTransactions} truelayer_transactions`,
      );
    }

    // Park the bespoke rows so PeriodicSyncJob stops selecting them.
    if (accountIds.length > 0) {
      await tx
        .update(truelayerAccounts)
        .set({ syncStatus: SyncStatus.MIGRATED, updatedAt: now })
        .where(
          and(
            eq(truelayerAccounts.connectionId, connection.id),
            inArray(truelayerAccounts.accountId, accountIds),
          ),
        );
    }

    console.log(
      `✓ connection ${connection.id}: ${accounts.length} accounts, ` +
        `${distinctSourceTransactions} transactions, parked`,
    );
  });
}

async function main(): Promise<void> {
  const connections = await db.select().from(truelayerConnections);
  console.log(`Backfilling ${connections.length} TrueLayer connection(s)…`);

  let failures = 0;
  for (const connection of connections) {
    try {
      await migrateConnection(connection);
    } catch (error) {
      failures += 1;
      console.error(
        `✗ connection ${connection.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (failures > 0) {
    console.error(`${failures} connection(s) failed — their transactions were rolled back.`);
    process.exit(1);
  }
  console.log("Backfill complete.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
