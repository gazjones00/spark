import { describe, expect, it, vi } from "vitest";
import type { BalanceService } from "../modules/accounts";
import type { TransactionSyncService } from "../modules/transactions";
import { HISTORICAL_DAYS, InitialSyncJob } from "./initial-sync.job";

function createJob() {
  const transactionSyncService = { syncTransactions: vi.fn().mockResolvedValue(5) };
  const balanceService = { syncBalance: vi.fn().mockResolvedValue(undefined) };
  const job = new InitialSyncJob(
    transactionSyncService as unknown as TransactionSyncService,
    balanceService as unknown as BalanceService,
  );
  return { job, transactionSyncService, balanceService };
}

describe("InitialSyncJob", () => {
  it("syncs balance and the full historical transaction window", async () => {
    const { job, transactionSyncService, balanceService } = createJob();

    await job.handle({ accountId: "acc-1", connectionId: "conn-1", accountType: "TRANSACTION" });

    expect(balanceService.syncBalance).toHaveBeenCalledWith({
      accountId: "acc-1",
      connectionId: "conn-1",
      accountType: "TRANSACTION",
    });
    expect(transactionSyncService.syncTransactions).toHaveBeenCalledWith({
      accountId: "acc-1",
      connectionId: "conn-1",
      accountType: "TRANSACTION",
      daysToSync: HISTORICAL_DAYS,
    });
  });

  it("propagates balance failures so BullMQ can retry the job", async () => {
    const { job, transactionSyncService, balanceService } = createJob();
    balanceService.syncBalance.mockRejectedValueOnce(new Error("balance failed"));

    await expect(job.handle({ accountId: "acc-1", connectionId: "conn-1" })).rejects.toThrow(
      "balance failed",
    );
    // Balance syncs first; the transaction sweep must not run on failure.
    expect(transactionSyncService.syncTransactions).not.toHaveBeenCalled();
  });
});
