import { SyncStatus } from "@spark/common";
import { truelayerAccounts } from "@spark/db/schema";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the query-builder helpers so we can assert on the due-selection
// predicate without standing up a real database.
vi.mock("@spark/db", () => ({
  and: vi.fn((...args: unknown[]) => ({ __and: args })),
  inArray: vi.fn((column: unknown, values: unknown) => ({ __inArray: { column, values } })),
  lte: vi.fn((column: unknown, value: unknown) => ({ __lte: { column, value } })),
  sql: vi.fn(() => ({ __sql: true })),
}));

import { and, inArray, lte } from "@spark/db";
import { Jobs } from "../modules/message-queue";
import { PeriodicSyncJob } from "./periodic-sync.job";

interface MockChains {
  dueAccounts: Array<{ accountId: string; connectionId: string; accountType: string | null }>;
}

function createJob({ dueAccounts }: MockChains) {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(dueAccounts),
  };
  const updateChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };
  const tx = {
    execute: vi.fn().mockResolvedValue({ rows: [{ locked: true }] }),
    select: vi.fn(() => selectChain),
    update: vi.fn(() => updateChain),
  };
  const db = {
    transaction: vi.fn(async (cb: (txArg: unknown) => unknown) => cb(tx)),
  };
  const queue = {
    add: vi.fn(async () => undefined),
  };

  const job = new PeriodicSyncJob(db as never, queue as never);
  return { job, db, queue, tx, selectChain, updateChain };
}

describe("PeriodicSyncJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("selects OK and ERROR accounts gated by the backoff window, excluding NEEDS_REAUTH", async () => {
    const { job } = createJob({
      dueAccounts: [{ accountId: "acc-1", connectionId: "conn-1", accountType: "TRANSACTION" }],
    });

    await job.handle();

    // ERROR rows self-heal once their backoff elapses; NEEDS_REAUTH is terminal
    // and must never be re-queued even when nextSyncAt is in the past.
    expect(inArray).toHaveBeenCalledWith(truelayerAccounts.syncStatus, [
      SyncStatus.OK,
      SyncStatus.ERROR,
    ]);
    const statusCall = vi
      .mocked(inArray)
      .mock.calls.find((call) => call[0] === truelayerAccounts.syncStatus);
    expect(statusCall?.[1]).not.toContain(SyncStatus.NEEDS_REAUTH);

    expect(lte).toHaveBeenCalledWith(truelayerAccounts.nextSyncAt, expect.any(Date));
    expect(and).toHaveBeenCalled();
  });

  it("enqueues an AccountSync job for each due account", async () => {
    const { job, queue } = createJob({
      dueAccounts: [
        { accountId: "acc-1", connectionId: "conn-1", accountType: "TRANSACTION" },
        { accountId: "acc-2", connectionId: "conn-2", accountType: null },
      ],
    });

    await job.handle();

    expect(queue.add).toHaveBeenCalledTimes(2);
    expect(queue.add).toHaveBeenCalledWith(
      Jobs.AccountSync,
      expect.objectContaining({ accountId: "acc-1", connectionId: "conn-1" }),
      expect.objectContaining({ jobId: expect.stringContaining("account:acc-1:") }),
    );
  });

  it("enqueues nothing when no accounts are due", async () => {
    const { job, queue, tx } = createJob({ dueAccounts: [] });

    await job.handle();

    expect(queue.add).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
  });

  it("skips the run when the advisory lock is not acquired", async () => {
    const { job, queue, tx } = createJob({
      dueAccounts: [{ accountId: "acc-1", connectionId: "conn-1", accountType: "TRANSACTION" }],
    });
    tx.execute.mockResolvedValueOnce({ rows: [{ locked: false }] });

    await job.handle();

    expect(tx.select).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });
});
