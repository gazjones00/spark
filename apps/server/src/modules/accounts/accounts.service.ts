import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { TRUELAYER_PROVIDER_ID, truelayerAccountIdFromExternalId } from "@spark/connectors";
import type { Database } from "@spark/db";
import { and, desc, eq, inArray } from "@spark/db";
import type { UpdateAccountInput } from "@spark/schema";
import { balanceSnapshots, connectorConnections, financialAccounts } from "@spark/db/schema";
import { DATABASE_CONNECTION } from "../database";
import { toAccountDto, type AccountConnectionState } from "./mappers/account.mapper";

type BalanceSnapshotRow = typeof balanceSnapshots.$inferSelect;

/**
 * Banking account reads, served from the canonical connector tables
 * (financial_accounts + latest balance_snapshots + connection sync state) —
 * see docs/adr/0001. The API contract shape is unchanged.
 */
@Injectable()
export class AccountsService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  async list(userId: string) {
    const rows = await this.db
      .select({
        account: financialAccounts,
        syncStatus: connectorConnections.syncStatus,
        lastSyncedAt: connectorConnections.lastSyncedAt,
      })
      .from(financialAccounts)
      .innerJoin(connectorConnections, eq(financialAccounts.connectionId, connectorConnections.id))
      .where(
        and(
          eq(financialAccounts.userId, userId),
          eq(financialAccounts.providerId, TRUELAYER_PROVIDER_ID),
        ),
      )
      .orderBy(financialAccounts.createdAt);

    const snapshots = await this.latestSnapshots(rows.map((row) => row.account.connectionId));

    return {
      accounts: rows.map((row) =>
        toAccountDto(
          row.account,
          { syncStatus: row.syncStatus, lastSyncedAt: row.lastSyncedAt },
          snapshots.get(snapshotKey(row.account.connectionId, row.account.externalId)),
        ),
      ),
    };
  }

  async update(userId: string, input: UpdateAccountInput) {
    // Scoped to TrueLayer rows — this API's semantics (and delete's allow-list
    // rewrite) are TrueLayer-specific, and other providers' accounts share
    // these tables.
    const existing = await this.db.query.financialAccounts.findFirst({
      where: and(
        eq(financialAccounts.id, input.id),
        eq(financialAccounts.providerId, TRUELAYER_PROVIDER_ID),
      ),
    });

    if (!existing || existing.userId !== userId) {
      throw new NotFoundException("Account not found");
    }

    const updateData: Partial<typeof financialAccounts.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.displayName !== undefined) {
      updateData.displayName = input.displayName;
    }

    const [updated] = await this.db
      .update(financialAccounts)
      .set(updateData)
      .where(eq(financialAccounts.id, input.id))
      .returning();

    if (!updated) {
      throw new NotFoundException("Account not found");
    }

    const connection = await this.connectionState(updated.connectionId);
    const snapshots = await this.latestSnapshots([updated.connectionId]);
    return {
      account: toAccountDto(
        updated,
        connection,
        snapshots.get(snapshotKey(updated.connectionId, updated.externalId)),
      ),
    };
  }

  async delete(userId: string, id: string) {
    const existing = await this.db.query.financialAccounts.findFirst({
      where: and(
        eq(financialAccounts.id, id),
        eq(financialAccounts.providerId, TRUELAYER_PROVIDER_ID),
      ),
    });

    if (!existing || existing.userId !== userId) {
      throw new NotFoundException("Account not found");
    }

    await this.db.delete(financialAccounts).where(eq(financialAccounts.id, id));

    // Pin the connection's allow-list to its remaining accounts so the next
    // sync doesn't resurrect the deleted one (the connector treats a present
    // allow-list as authoritative).
    const siblings = await this.db
      .select({ metadata: financialAccounts.metadata, externalId: financialAccounts.externalId })
      .from(financialAccounts)
      .where(
        and(
          eq(financialAccounts.connectionId, existing.connectionId),
          eq(financialAccounts.providerId, TRUELAYER_PROVIDER_ID),
        ),
      );
    // externalId deterministically encodes the TrueLayer account id, so a row
    // with missing metadata still makes it into the allow-list (an omitted id
    // would silently stop that account syncing).
    const remainingAccountIds = siblings.map((row) =>
      typeof row.metadata.truelayerAccountId === "string"
        ? row.metadata.truelayerAccountId
        : truelayerAccountIdFromExternalId(row.externalId),
    );

    const connection = await this.db.query.connectorConnections.findFirst({
      where: eq(connectorConnections.id, existing.connectionId),
    });
    if (connection) {
      await this.db
        .update(connectorConnections)
        .set({
          metadata: { ...connection.metadata, accountIds: remainingAccountIds },
          updatedAt: new Date(),
        })
        .where(eq(connectorConnections.id, existing.connectionId));
    }

    return { success: true };
  }

  private async connectionState(connectionId: string): Promise<AccountConnectionState> {
    const connection = await this.db.query.connectorConnections.findFirst({
      where: eq(connectorConnections.id, connectionId),
      columns: { syncStatus: true, lastSyncedAt: true },
    });
    return {
      syncStatus: connection?.syncStatus ?? "ERROR",
      lastSyncedAt: connection?.lastSyncedAt ?? null,
    };
  }

  /** Latest balance snapshot per (connection, account), keyed for lookup. */
  private async latestSnapshots(connectionIds: string[]): Promise<Map<string, BalanceSnapshotRow>> {
    const uniqueIds = [...new Set(connectionIds)];
    if (uniqueIds.length === 0) {
      return new Map();
    }
    const rows = await this.db
      .selectDistinctOn([balanceSnapshots.connectionId, balanceSnapshots.accountExternalId])
      .from(balanceSnapshots)
      .where(inArray(balanceSnapshots.connectionId, uniqueIds))
      .orderBy(
        balanceSnapshots.connectionId,
        balanceSnapshots.accountExternalId,
        desc(balanceSnapshots.observedAt),
      );
    return new Map(rows.map((row) => [snapshotKey(row.connectionId, row.accountExternalId), row]));
  }
}

function snapshotKey(connectionId: string, accountExternalId: string): string {
  return `${connectionId}:${accountExternalId}`;
}
