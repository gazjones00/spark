import { truelayerAccountIdFromExternalId } from "@spark/connectors";
import { balanceSnapshots, financialAccounts } from "@spark/db/schema";
import type { Account, AccountNumber, AccountProvider, AccountType } from "@spark/schema";
import type { SyncStatusType } from "@spark/common";

type FinancialAccountRow = typeof financialAccounts.$inferSelect;
type BalanceSnapshotRow = typeof balanceSnapshots.$inferSelect;

export interface AccountConnectionState {
  syncStatus: SyncStatusType;
  lastSyncedAt: Date | null;
}

/**
 * Reassembles the TrueLayer-shaped Account DTO from a canonical
 * financial_accounts row: banking detail (accountNumber, provider, raw
 * account type) lives in the row's metadata (written by the TrueLayer
 * connector mappers), balances come from the latest balance snapshot, and
 * sync state comes from the owning connection.
 */
export const toAccountDto = (
  account: FinancialAccountRow,
  connection: AccountConnectionState,
  snapshot?: BalanceSnapshotRow | null,
): Account => {
  const metadata = account.metadata;
  const snapshotMetadata = (snapshot?.metadata ?? {}) as Record<string, unknown>;
  return {
    id: account.id,
    accountId:
      typeof metadata.truelayerAccountId === "string"
        ? metadata.truelayerAccountId
        : truelayerAccountIdFromExternalId(account.externalId),
    accountType: (metadata.truelayerAccountType as AccountType | null | undefined) ?? null,
    displayName: account.displayName,
    currency: account.currency as Account["currency"],
    accountNumber: (metadata.accountNumber as AccountNumber | undefined) ?? {},
    provider: (metadata.provider as AccountProvider | undefined) ?? {},
    updatedAt: account.updatedAt.toISOString(),
    currentBalance: snapshot?.cash ?? null,
    availableBalance: snapshot?.availableCash ?? null,
    overdraft: typeof snapshotMetadata.overdraft === "string" ? snapshotMetadata.overdraft : null,
    balanceUpdatedAt: snapshot?.observedAt.toISOString() ?? null,
    syncStatus: connection.syncStatus,
    lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
  };
};
