import { SyncStatus } from "@spark/common";
import { truelayerAccounts } from "@spark/db/schema";
import { toAccountDto, toAccountsListDto } from "./account.mapper";

type DbAccount = typeof truelayerAccounts.$inferSelect;

const createAccount = (overrides: Partial<DbAccount> = {}): DbAccount => ({
  id: "account-row-id",
  accountId: "account-id",
  connectionId: "connection-id",
  userId: "user-id",
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
  updateTimestamp: new Date("2026-01-01T00:00:00.000Z"),
  currentBalance: "10.5000",
  availableBalance: "8.2500",
  overdraft: "100.0000",
  balanceUpdatedAt: new Date("2026-01-01T01:00:00.000Z"),
  syncStatus: SyncStatus.OK,
  lastSyncedAt: new Date("2026-01-01T02:00:00.000Z"),
  nextSyncAt: new Date("2026-01-01T03:00:00.000Z"),
  createdAt: new Date("2026-01-01T04:00:00.000Z"),
  updatedAt: new Date("2026-01-01T05:00:00.000Z"),
  ...overrides,
});

describe("account mapper", () => {
  it("maps a db row to the account dto shape", () => {
    const mapped = toAccountDto(createAccount());

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

  it("maps nullable timestamps to null", () => {
    const mapped = toAccountDto(
      createAccount({
        balanceUpdatedAt: null,
        lastSyncedAt: null,
      }),
    );

    expect(mapped.balanceUpdatedAt).toBeNull();
    expect(mapped.lastSyncedAt).toBeNull();
  });

  it("maps a list of db rows", () => {
    const first = createAccount();
    const second = createAccount({ id: "account-row-id-2", accountId: "account-id-2" });

    const mapped = toAccountsListDto([first, second]);

    expect(mapped.accounts).toHaveLength(2);
    expect(mapped.accounts[1]).toMatchObject({
      id: "account-row-id-2",
      accountId: "account-id-2",
    });
  });
});
