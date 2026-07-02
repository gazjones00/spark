import { SyncStatus } from "@spark/common";
import { balanceSnapshots, financialAccounts } from "@spark/db/schema";
import { toAccountDto } from "./account.mapper";

type FinancialAccountRow = typeof financialAccounts.$inferSelect;
type BalanceSnapshotRow = typeof balanceSnapshots.$inferSelect;

const createAccount = (overrides: Partial<FinancialAccountRow> = {}): FinancialAccountRow => ({
  id: "account-row-id",
  connectionId: "connection-id",
  userId: "user-id",
  providerId: "truelayer",
  externalId: "truelayer:account:account-id",
  type: "CASH",
  displayName: "Everyday Account",
  currency: "GBP",
  metadata: {
    truelayerAccountId: "account-id",
    truelayerAccountType: "TRANSACTION",
    accountNumber: { number: "12345678", sortCode: "112233" },
    provider: {
      providerId: "provider-id",
      displayName: "Bank",
      logoUri: "https://bank.example/logo.png",
    },
  },
  createdAt: new Date("2026-01-01T04:00:00.000Z"),
  updatedAt: new Date("2026-01-01T05:00:00.000Z"),
  ...overrides,
});

const createSnapshot = (overrides: Partial<BalanceSnapshotRow> = {}): BalanceSnapshotRow => ({
  id: "snapshot-id",
  connectionId: "connection-id",
  accountExternalId: "truelayer:account:account-id",
  providerId: "truelayer",
  currency: "GBP",
  cash: "10.5000",
  availableCash: "8.2500",
  blockedCash: null,
  invested: null,
  total: "10.5000",
  observedAt: new Date("2026-01-01T01:00:00.000Z"),
  metadata: { overdraft: "100.0000" },
  createdAt: new Date("2026-01-01T01:00:00.000Z"),
  ...overrides,
});

const CONNECTION_STATE = {
  syncStatus: SyncStatus.OK,
  lastSyncedAt: new Date("2026-01-01T02:00:00.000Z"),
};

describe("account mapper (canonical tables)", () => {
  it("reassembles the TrueLayer-shaped dto from a financial_accounts row", () => {
    const mapped = toAccountDto(createAccount(), CONNECTION_STATE, createSnapshot());

    expect(mapped).toEqual({
      id: "account-row-id",
      accountId: "account-id",
      accountType: "TRANSACTION",
      displayName: "Everyday Account",
      currency: "GBP",
      accountNumber: {
        number: "12345678",
        sortCode: "112233",
      },
      provider: {
        providerId: "provider-id",
        displayName: "Bank",
        logoUri: "https://bank.example/logo.png",
      },
      updatedAt: "2026-01-01T05:00:00.000Z",
      currentBalance: "10.5000",
      availableBalance: "8.2500",
      overdraft: "100.0000",
      balanceUpdatedAt: "2026-01-01T01:00:00.000Z",
      syncStatus: "OK",
      lastSyncedAt: "2026-01-01T02:00:00.000Z",
    });
  });

  it("maps missing snapshot/sync data to nulls", () => {
    const mapped = toAccountDto(
      createAccount(),
      { syncStatus: SyncStatus.OK, lastSyncedAt: null },
      null,
    );

    expect(mapped.currentBalance).toBeNull();
    expect(mapped.availableBalance).toBeNull();
    expect(mapped.overdraft).toBeNull();
    expect(mapped.balanceUpdatedAt).toBeNull();
    expect(mapped.lastSyncedAt).toBeNull();
  });

  it("derives the TrueLayer account id from externalId when metadata lacks it", () => {
    const mapped = toAccountDto(
      createAccount({ metadata: {} }),
      CONNECTION_STATE,
      createSnapshot(),
    );
    expect(mapped.accountId).toBe("account-id");
    expect(mapped.accountType).toBeNull();
    expect(mapped.accountNumber).toEqual({});
    expect(mapped.provider).toEqual({});
  });
});
