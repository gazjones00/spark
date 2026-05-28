import { SyncStatus } from "@spark/common";
import { connectorConnections } from "@spark/db/schema";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the query-builder helpers so we can assert on how the due-selection
// predicate is constructed without standing up a real database.
vi.mock("@spark/db", () => ({
  and: vi.fn((...args: unknown[]) => ({ __and: args })),
  inArray: vi.fn((column: unknown, values: unknown) => ({ __inArray: { column, values } })),
  lte: vi.fn((column: unknown, value: unknown) => ({ __lte: { column, value } })),
  sql: vi.fn(() => ({ __sql: true })),
}));

import { and, inArray, lte } from "@spark/db";
import { Jobs } from "../modules/message-queue";
import { ConnectorPeriodicSyncJob } from "./connector-periodic-sync.job";

interface MockChains {
  dueConnections: Array<{ id: string; userId: string }>;
}

function createJob({ dueConnections }: MockChains) {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(dueConnections),
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

  const job = new ConnectorPeriodicSyncJob(db as never, queue as never);
  return { job, db, queue, tx, selectChain, updateChain };
}

describe("ConnectorPeriodicSyncJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("selects OK and ERROR connections gated by the backoff window, excluding NEEDS_REAUTH", async () => {
    const { job } = createJob({ dueConnections: [{ id: "conn-1", userId: "user-1" }] });

    await job.handle();

    // ERROR rows are re-picked so transient failures self-heal; NEEDS_REAUTH
    // is terminal and must never appear in the selection set.
    expect(inArray).toHaveBeenCalledWith(connectorConnections.syncStatus, [
      SyncStatus.OK,
      SyncStatus.ERROR,
    ]);
    const statusCall = vi
      .mocked(inArray)
      .mock.calls.find((call) => call[0] === connectorConnections.syncStatus);
    expect(statusCall?.[1]).not.toContain(SyncStatus.NEEDS_REAUTH);

    // The backoff gate (nextSyncAt <= now) bounds how often ERROR rows retry.
    expect(lte).toHaveBeenCalledWith(connectorConnections.nextSyncAt, expect.any(Date));
    expect(and).toHaveBeenCalled();
  });

  it("dispatches a ConnectorSync job for each due connection", async () => {
    const { job, queue } = createJob({
      dueConnections: [
        { id: "conn-1", userId: "user-1" },
        { id: "conn-2", userId: "user-2" },
      ],
    });

    await job.handle();

    expect(queue.add).toHaveBeenCalledTimes(2);
    expect(queue.add).toHaveBeenCalledWith(
      Jobs.ConnectorSync,
      expect.objectContaining({ connectionId: "conn-1", userId: "user-1" }),
      expect.objectContaining({ attempts: 3 }),
    );
  });

  it("dispatches nothing when no connections are due", async () => {
    const { job, queue, tx } = createJob({ dueConnections: [] });

    await job.handle();

    expect(queue.add).not.toHaveBeenCalled();
    // No rows selected → no nextSyncAt push-forward update is issued.
    expect(tx.update).not.toHaveBeenCalled();
  });

  it("skips the run when the advisory lock is not acquired", async () => {
    const { job, queue, tx } = createJob({ dueConnections: [{ id: "conn-1", userId: "user-1" }] });
    tx.execute.mockResolvedValueOnce({ rows: [{ locked: false }] });

    await job.handle();

    expect(tx.select).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });
});
