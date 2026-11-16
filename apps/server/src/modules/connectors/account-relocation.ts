import { alias, and, eq, ne, notExists, sql, type DatabaseExecutor } from "@spark/db";
import {
  accountDailyBalances,
  balanceSnapshots,
  connectorSyncCursors,
  financialAccounts,
  financialTransactions,
  holdings,
  portfolioSnapshots,
  transactionCategoryOverrides,
  transactionEnrichments,
} from "@spark/db/schema";
import { CategorySource } from "@spark/schema";

/**
 * An account carried onto a reconnected connection. Either half may change:
 * the provider can re-issue the account's id under the new consent, and the
 * account can arrive from another of the user's connections that the new
 * consent also covers.
 */
export interface AccountMove {
  /** Where the account's rows live now; the target itself when only its id changes. */
  fromConnectionId: string;
  fromExternalId: string;
  toExternalId: string;
  /** Sync cursors keyed to the account, renamed alongside it. */
  cursorResources?: ReadonlyArray<{ from: string; to: string }>;
  /**
   * Merged into the account row's metadata, for provider fields that mirror
   * the external id and must change with it.
   */
  accountMetadata?: Record<string, unknown>;
}

/**
 * Re-points every row hanging off one account at its new connection and
 * external id, so the account keeps its history, balances and enrichment
 * (enrichment hangs off transaction ids, which never change here).
 *
 * A row that would collide with one the target already holds stays where it
 * is: the target's copy is the same bank record, and a retired source's
 * leftovers are removed with it. That keeps a reconnect from failing on an
 * orphan a deleted account left behind. A user's category override on a
 * left-behind transaction is handed to the target's copy unless that copy has
 * its own, which wins. Raw provider records and sync-run history are
 * per-connection audit trails and are not moved.
 */
export async function relocateAccount(
  db: DatabaseExecutor,
  targetConnectionId: string,
  move: AccountMove,
  now: Date,
): Promise<void> {
  const { fromConnectionId, fromExternalId, toExternalId } = move;
  // Within one connection a transaction or holding keeps its own external id,
  // so only a move across connections can collide on those keys.
  const crossesConnections = fromConnectionId !== targetConnectionId;

  const existingAccount = alias(financialAccounts, "existing_account");
  await db
    .update(financialAccounts)
    .set({
      connectionId: targetConnectionId,
      externalId: toExternalId,
      ...(move.accountMetadata
        ? {
            metadata: sql`${financialAccounts.metadata} || ${JSON.stringify(move.accountMetadata)}::jsonb`,
          }
        : {}),
      updatedAt: now,
    })
    .where(
      and(
        eq(financialAccounts.connectionId, fromConnectionId),
        eq(financialAccounts.externalId, fromExternalId),
        notExists(
          db
            .select({ id: existingAccount.id })
            .from(existingAccount)
            .where(
              and(
                eq(existingAccount.connectionId, targetConnectionId),
                eq(existingAccount.externalId, toExternalId),
              ),
            ),
        ),
      ),
    );

  const existingTransaction = alias(financialTransactions, "existing_transaction");
  await db
    .update(financialTransactions)
    .set({ connectionId: targetConnectionId, accountExternalId: toExternalId })
    .where(
      and(
        eq(financialTransactions.connectionId, fromConnectionId),
        eq(financialTransactions.accountExternalId, fromExternalId),
        crossesConnections
          ? notExists(
              db
                .select({ id: existingTransaction.id })
                .from(existingTransaction)
                .where(
                  and(
                    eq(existingTransaction.connectionId, targetConnectionId),
                    eq(existingTransaction.externalId, financialTransactions.externalId),
                    ne(existingTransaction.id, financialTransactions.id),
                  ),
                ),
            )
          : undefined,
      ),
    );
  if (crossesConnections) {
    await handOverCategoryOverrides(db, targetConnectionId, move, now);
  }

  const existingDay = alias(accountDailyBalances, "existing_day");
  await db
    .update(accountDailyBalances)
    .set({ connectionId: targetConnectionId, accountExternalId: toExternalId })
    .where(
      and(
        eq(accountDailyBalances.connectionId, fromConnectionId),
        eq(accountDailyBalances.accountExternalId, fromExternalId),
        notExists(
          db
            .select({ id: existingDay.id })
            .from(existingDay)
            .where(
              and(
                eq(existingDay.connectionId, targetConnectionId),
                eq(existingDay.accountExternalId, toExternalId),
                eq(existingDay.day, accountDailyBalances.day),
              ),
            ),
        ),
      ),
    );

  const existingBalance = alias(balanceSnapshots, "existing_balance");
  await db
    .update(balanceSnapshots)
    .set({ connectionId: targetConnectionId, accountExternalId: toExternalId })
    .where(
      and(
        eq(balanceSnapshots.connectionId, fromConnectionId),
        eq(balanceSnapshots.accountExternalId, fromExternalId),
        notExists(
          db
            .select({ id: existingBalance.id })
            .from(existingBalance)
            .where(
              and(
                eq(existingBalance.connectionId, targetConnectionId),
                eq(existingBalance.accountExternalId, toExternalId),
                eq(existingBalance.observedAt, balanceSnapshots.observedAt),
              ),
            ),
        ),
      ),
    );

  const existingHolding = alias(holdings, "existing_holding");
  await db
    .update(holdings)
    .set({ connectionId: targetConnectionId, accountExternalId: toExternalId })
    .where(
      and(
        eq(holdings.connectionId, fromConnectionId),
        eq(holdings.accountExternalId, fromExternalId),
        crossesConnections
          ? notExists(
              db
                .select({ id: existingHolding.id })
                .from(existingHolding)
                .where(
                  and(
                    eq(existingHolding.connectionId, targetConnectionId),
                    eq(existingHolding.externalId, holdings.externalId),
                    ne(existingHolding.id, holdings.id),
                  ),
                ),
            )
          : undefined,
      ),
    );

  const existingPortfolio = alias(portfolioSnapshots, "existing_portfolio");
  await db
    .update(portfolioSnapshots)
    .set({ connectionId: targetConnectionId, accountExternalId: toExternalId })
    .where(
      and(
        eq(portfolioSnapshots.connectionId, fromConnectionId),
        eq(portfolioSnapshots.accountExternalId, fromExternalId),
        notExists(
          db
            .select({ id: existingPortfolio.id })
            .from(existingPortfolio)
            .where(
              and(
                eq(existingPortfolio.connectionId, targetConnectionId),
                eq(existingPortfolio.accountExternalId, toExternalId),
                eq(existingPortfolio.observedAt, portfolioSnapshots.observedAt),
              ),
            ),
        ),
      ),
    );

  const existingCursor = alias(connectorSyncCursors, "existing_cursor");
  for (const resource of move.cursorResources ?? []) {
    await db
      .update(connectorSyncCursors)
      .set({ connectionId: targetConnectionId, resource: resource.to, updatedAt: now })
      .where(
        and(
          eq(connectorSyncCursors.connectionId, fromConnectionId),
          eq(connectorSyncCursors.resource, resource.from),
          notExists(
            db
              .select({ id: existingCursor.id })
              .from(existingCursor)
              .where(
                and(
                  eq(existingCursor.connectionId, targetConnectionId),
                  eq(existingCursor.resource, resource.to),
                ),
              ),
          ),
        ),
      );
  }
}

/**
 * A transaction left behind on the source (because the target already holds
 * the same bank record) would take the user's category override down with
 * it when the source is retired. Re-point such overrides at the target's
 * copy, then reflect them in its enrichment the way a fresh derivation
 * would: the override wins, the derived merchant stays.
 */
async function handOverCategoryOverrides(
  db: DatabaseExecutor,
  targetConnectionId: string,
  move: AccountMove,
  now: Date,
): Promise<void> {
  const leftover = alias(financialTransactions, "leftover_transaction");
  const counterpart = alias(financialTransactions, "counterpart_transaction");
  const counterpartOverride = alias(transactionCategoryOverrides, "counterpart_override");

  const handedOver = await db
    .update(transactionCategoryOverrides)
    .set({ transactionId: sql`${counterpart.id}`, updatedAt: now })
    .from(leftover)
    .innerJoin(
      counterpart,
      and(
        eq(counterpart.connectionId, targetConnectionId),
        eq(counterpart.externalId, leftover.externalId),
      ),
    )
    .where(
      and(
        eq(transactionCategoryOverrides.transactionId, leftover.id),
        eq(leftover.connectionId, move.fromConnectionId),
        eq(leftover.accountExternalId, move.fromExternalId),
        notExists(
          db
            .select({ id: counterpartOverride.id })
            .from(counterpartOverride)
            .where(eq(counterpartOverride.transactionId, counterpart.id)),
        ),
      ),
    )
    .returning({
      transactionId: transactionCategoryOverrides.transactionId,
      category: transactionCategoryOverrides.category,
    });

  for (const override of handedOver) {
    await db
      .update(transactionEnrichments)
      .set({
        category: override.category,
        source: CategorySource.USER_OVERRIDE,
        derivedAt: now,
      })
      .where(eq(transactionEnrichments.transactionId, override.transactionId));
  }
}
