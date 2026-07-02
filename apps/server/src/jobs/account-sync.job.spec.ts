import { describe, expect, it, vi } from "vitest";
import type { Database } from "@spark/db";
import type { BalanceService } from "../modules/accounts";
import type { TransactionSyncService } from "../modules/transactions";
import { AccountSyncJob } from "./account-sync.job";
import { HISTORICAL_DAYS } from "./initial-sync.job";

function createJob(
  account: { accountType?: string | null; lastSyncedAt?: Date | null } | undefined,
) {
  const transactionSyncService = { syncTransactions: vi.fn().mockResolvedValue(1) };
  const balanceService = { syncBalance: vi.fn().mockResolvedValue(undefined) };
  const db = {
    query: { truelayerAccounts: { findFirst: vi.fn().mockResolvedValue(account) } },
  };
  const job = new AccountSyncJob(
    transactionSyncService as unknown as TransactionSyncService,
    balanceService as unknown as BalanceService,
    db as unknown as Database,
  );
  return { job, transactionSyncService, balanceService };
}

describe("AccountSyncJob", () => {
  it("falls back to the full 90-day window when lastSyncedAt is null", async () => {
    const { job, transactionSyncService } = createJob({
      accountType: "TRANSACTION",
      lastSyncedAt: null,
    });

    await job.handle({ accountId: "acc-1", connectionId: "conn-1" });

    expect(transactionSyncService.syncTransactions).toHaveBeenCalledWith({
      accountId: "acc-1",
      connectionId: "conn-1",
      accountType: "TRANSACTION",
      daysToSync: HISTORICAL_DAYS,
    });
  });

  it("passes lastSyncedAt through for incremental syncs (no 90-day window)", async () => {
    const lastSyncedAt = new Date("2026-06-30T12:00:00.000Z");
    const { job, transactionSyncService } = createJob({
      accountType: "TRANSACTION",
      lastSyncedAt,
    });

    await job.handle({ accountId: "acc-1", connectionId: "conn-1" });

    expect(transactionSyncService.syncTransactions).toHaveBeenCalledWith({
      accountId: "acc-1",
      connectionId: "conn-1",
      accountType: "TRANSACTION",
      lastSyncedAt,
    });
    const [input] = transactionSyncService.syncTransactions.mock.calls[0];
    expect(input).not.toHaveProperty("daysToSync");
  });

  it("syncs balance alongside transactions", async () => {
    const { job, balanceService } = createJob({ accountType: "SAVINGS", lastSyncedAt: null });

    await job.handle({ accountId: "acc-1", connectionId: "conn-1" });

    expect(balanceService.syncBalance).toHaveBeenCalledWith({
      accountId: "acc-1",
      connectionId: "conn-1",
      accountType: "SAVINGS",
    });
  });

  it("prefers the payload accountType over the stored one", async () => {
    const { job, balanceService } = createJob({ accountType: "SAVINGS", lastSyncedAt: null });

    await job.handle({ accountId: "acc-1", connectionId: "conn-1", accountType: "CREDIT_CARD" });

    expect(balanceService.syncBalance).toHaveBeenCalledWith(
      expect.objectContaining({ accountType: "CREDIT_CARD" }),
    );
  });

  it("treats a missing account row as a first sync (90-day window)", async () => {
    const { job, transactionSyncService } = createJob(undefined);

    await job.handle({ accountId: "acc-1", connectionId: "conn-1" });

    expect(transactionSyncService.syncTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ daysToSync: HISTORICAL_DAYS }),
    );
  });
});
