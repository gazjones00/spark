import { truelayerTransactions } from "@spark/db/schema";
import type { Transaction } from "@spark/schema";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TruelayerClient, TruelayerConnectionService } from "../../providers/truelayer";
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

function createService(transactions: Transaction[]) {
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
    getTransactions: vi.fn(async () => transactions),
  };
  const connectionService = {
    getAccessToken: vi.fn(async () => "access-token"),
  };

  const service = new TransactionSyncService(
    truelayerClient as unknown as TruelayerClient,
    connectionService as unknown as TruelayerConnectionService,
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
});
