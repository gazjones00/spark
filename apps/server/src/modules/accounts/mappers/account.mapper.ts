import { truelayerAccounts } from "@spark/db/schema";
import type { Account } from "@spark/schema";

type DbAccount = typeof truelayerAccounts.$inferSelect;

export const toAccountDto = (account: DbAccount): Account => ({
  id: account.id,
  accountId: account.accountId,
  accountType: account.accountType,
  displayName: account.displayName,
  currency: account.currency,
  accountNumber: account.accountNumber,
  provider: account.provider,
  updatedAt: account.updatedAt.toISOString(),
  currentBalance: account.currentBalance,
  availableBalance: account.availableBalance,
  overdraft: account.overdraft,
  balanceUpdatedAt: account.balanceUpdatedAt?.toISOString() ?? null,
  syncStatus: account.syncStatus,
  lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null,
});

export const toAccountsListDto = (accounts: DbAccount[]) => ({
  accounts: accounts.map(toAccountDto),
});
