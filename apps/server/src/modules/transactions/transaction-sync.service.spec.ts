import { SyncStatus } from "@spark/common";
import { truelayerAccounts, truelayerTransactions } from "@spark/db/schema";
import type { Transaction } from "@spark/schema";
import { TrueLayerAuthError } from "@spark/truelayer/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TruelayerClient, TruelayerConnectionService } from "../../providers/truelayer";
import { TruelayerAccountStatusService } from "../../providers/truelayer";
import { TokenExpiredError } from "../../providers/truelayer";
import { TransactionSyncService } from "./transaction-sync.service";

const TRANSACTION: Transaction = {
  transactionId: "txn-1",
  normalisedProviderTransactionId: "norm-1",
  providerTransactionId: "prov-1",
  timestamp: "2026-01-30T10:00:00.000Z",
  description: "Coffee",
  amount: -3.5,
  currency: "GBP",
  transactionType: "DEBIT",
  transactionCategory: "PURCHASE",
  transactionClassification: ["Food & Dining"],
  merchantName: "Cafe",
  runningBalance: { amount: 96.5, currency: "GBP" },
  meta: { providerTransactionId: "prov-1" },
};

function createService(
  transactions: Transaction[],
  options: { getTransactionsError?: unknown } = {},
) {
  const insertChain = {
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: "row-1" }]),
  };
  const updateChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };
  const db = {
    insert: vi.fn(() => insertChain),
    update: vi.fn(() => updateChain),
  };
  const truelayerClient = {
    getTransactions: options.getTransactionsError
      ? vi.fn(async () => {
          throw options.getTransactionsError;
        })
      : vi.fn(async () => transactions),
  };
  const connectionService = {
    getAccessToken: vi.fn(async () => "access-token"),
  };
  // Real status service over the same mock db so its single update() is
  // exercised through the public sync path (rather than re-mocking the write).
  const statusService = new TruelayerAccountStatusService(db as never);

  const service = new TransactionSyncService(
    truelayerClient as unknown as TruelayerClient,
    connectionService as unknown as TruelayerConnectionService,
    statusService,
    db as never,
  );

  return { service, db, insertChain, updateChain };
}

describe("TransactionSyncService.syncTransactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upserts on conflict (do-update, not do-nothing) keyed on (transactionId, accountId)", async () => {
    const { service, insertChain } = createService([TRANSACTION]);

    await service.syncTransactions({ accountId: "acc-1", connectionId: "conn-1", daysToSync: 7 });

    expect(insertChain.onConflictDoNothing).not.toHaveBeenCalled();
    expect(insertChain.onConflictDoUpdate).toHaveBeenCalledTimes(1);

    const call = insertChain.onConflictDoUpdate.mock.calls[0]?.[0] as {
      target: unknown[];
      set: Record<string, unknown>;
    };
    expect(call.target).toEqual([
      truelayerTransactions.transactionId,
      truelayerTransactions.accountId,
    ]);
  });

  it("sets every mutable column plus updatedAt, and never the identity columns", async () => {
    const { service, insertChain } = createService([TRANSACTION]);

    await service.syncTransactions({ accountId: "acc-1", connectionId: "conn-1", daysToSync: 7 });

    const call = insertChain.onConflictDoUpdate.mock.calls[0]?.[0] as {
      set: Record<string, unknown>;
    };

    const mutableColumns = [
      "normalisedProviderTransactionId",
      "providerTransactionId",
      "timestamp",
      "description",
      "amount",
      "currency",
      "transactionType",
      "transactionCategory",
      "transactionClassification",
      "merchantName",
      "runningBalance",
      "meta",
      "updatedAt",
    ];
    expect(Object.keys(call.set).sort()).toEqual([...mutableColumns].sort());

    // Identity / PK columns must never be overwritten on conflict.
    expect(call.set).not.toHaveProperty("id");
    expect(call.set).not.toHaveProperty("transactionId");
    expect(call.set).not.toHaveProperty("accountId");

    // updatedAt advances on every upsert.
    expect(call.set.updatedAt).toBeInstanceOf(Date);
  });

  it("returns the count of upserted (inserted-or-updated) rows", async () => {
    const { service, insertChain } = createService([TRANSACTION]);
    insertChain.returning.mockResolvedValue([{ id: "row-1" }, { id: "row-2" }]);

    const count = await service.syncTransactions({
      accountId: "acc-1",
      connectionId: "conn-1",
      daysToSync: 7,
    });

    expect(count).toBe(2);
  });

  it("short-circuits without an insert when there are no transactions", async () => {
    const { service, db } = createService([]);

    const count = await service.syncTransactions({
      accountId: "acc-1",
      connectionId: "conn-1",
      daysToSync: 7,
    });

    expect(count).toBe(0);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("maps a TrueLayerAuthError to NEEDS_REAUTH with no backoff and re-throws", async () => {
    const { service, db, updateChain } = createService([], {
      getTransactionsError: new TrueLayerAuthError("access_denied", "revoked", 401),
    });

    await expect(
      service.syncTransactions({ accountId: "acc-1", connectionId: "conn-1", daysToSync: 7 }),
    ).rejects.toBeInstanceOf(TrueLayerAuthError);

    expect(db.update).toHaveBeenCalledWith(truelayerAccounts);
    const set = updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(set.syncStatus).toBe(SyncStatus.NEEDS_REAUTH);
    // Terminal status must not schedule a retry.
    expect(set).not.toHaveProperty("nextSyncAt");
  });

  it("maps a TokenExpiredError to NEEDS_REAUTH", async () => {
    const { service, updateChain } = createService([], {
      getTransactionsError: new TokenExpiredError("conn-1"),
    });

    await expect(
      service.syncTransactions({ accountId: "acc-1", connectionId: "conn-1", daysToSync: 7 }),
    ).rejects.toBeInstanceOf(TokenExpiredError);

    const set = updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(set.syncStatus).toBe(SyncStatus.NEEDS_REAUTH);
    expect(set).not.toHaveProperty("nextSyncAt");
  });

  it("maps a generic/transient error to ERROR with a 30-minute backoff", async () => {
    const { service, updateChain } = createService([], {
      getTransactionsError: new Error("TrueLayer request failed: 500"),
    });

    const before = Date.now();
    await expect(
      service.syncTransactions({ accountId: "acc-1", connectionId: "conn-1", daysToSync: 7 }),
    ).rejects.toThrow();

    const set = updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(set.syncStatus).toBe(SyncStatus.ERROR);
    const nextSyncAt = set.nextSyncAt as Date;
    expect(nextSyncAt).toBeInstanceOf(Date);
    // ~30 minutes ahead (allow a generous lower bound for execution time).
    expect(nextSyncAt.getTime()).toBeGreaterThanOrEqual(before + 29 * 60 * 1000);
  });
});
