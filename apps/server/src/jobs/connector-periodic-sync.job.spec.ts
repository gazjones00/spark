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

import { and, inArray, lte, sql } from "@spark/db";
import { Jobs } from "../modules/message-queue";
import { ConnectorPeriodicSyncJob } from "./connector-periodic-sync.job";

interface MockChains {
  /** One entry per drain page; the select chain serves them in order. */
  duePages: Array<Array<{ id: string; userId: string }>>;
}

function createJob({ duePages }: MockChains) {
  let page = 0;
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() => {
      const due = duePages[page] ?? [];
      page += 1;
      return Promise.resolve(due);
    }),
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

function fullPage(size: number, offset = 0): Array<{ id: string; userId: string }> {
  return Array.from({ length: size }, (_, index) => ({
    id: `conn-${offset + index}`,
    userId: `user-${offset + index}`,
  }));
}

describe("ConnectorPeriodicSyncJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("selects OK and ERROR connections gated by the backoff window, excluding NEEDS_REAUTH", async () => {
    const { job } = createJob({ duePages: [[{ id: "conn-1", userId: "user-1" }]] });

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
      duePages: [
        [
          { id: "conn-1", userId: "user-1" },
          { id: "conn-2", userId: "user-2" },
        ],
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
    const { job, queue, tx } = createJob({ duePages: [[]] });

    await job.handle();

    expect(queue.add).not.toHaveBeenCalled();
    // No rows selected → no nextSyncAt push-forward update is issued.
    expect(tx.update).not.toHaveBeenCalled();
  });

  it("skips the run when the advisory lock is not acquired", async () => {
    const { job, queue, tx } = createJob({
      duePages: [[{ id: "conn-1", userId: "user-1" }]],
    });
    tx.execute.mockResolvedValueOnce({ rows: [{ locked: false }] });

    await job.handle();

    expect(tx.select).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it("drains successive pages in one tick instead of stopping at the first batch", async () => {
    const { job, queue, tx } = createJob({
      duePages: [fullPage(100), fullPage(100, 100), fullPage(40, 200)],
    });

    await job.handle();

    // Three reservation rounds inside the same locked transaction, then one
    // dispatch per drained connection — 240 in a single tick.
    expect(tx.update).toHaveBeenCalledTimes(3);
    expect(queue.add).toHaveBeenCalledTimes(240);
  });

  it("stops draining at the page bound so a pathological backlog cannot pin the worker", async () => {
    const { job, queue, tx } = createJob({
      duePages: Array.from({ length: 30 }, (_, index) => fullPage(100, index * 100)),
    });

    await job.handle();

    expect(tx.update).toHaveBeenCalledTimes(20);
    expect(queue.add).toHaveBeenCalledTimes(2_000);
  });

  it("reserves with per-row jitter instead of a shared minute boundary", async () => {
    const { job, updateChain } = createJob({
      duePages: [[{ id: "conn-1", userId: "user-1" }]],
    });

    await job.handle();

    // The reservation value is a SQL expression adding random() jitter, not
    // a JS Date truncated to the minute.
    const setArg = updateChain.set.mock.calls[0]?.[0] as { nextSyncAt: unknown };
    expect(setArg.nextSyncAt).not.toBeInstanceOf(Date);
    const jitterCall = vi.mocked(sql).mock.calls.find((callArgs) =>
      Array.from(callArgs[0] as unknown as string[])
        .join("")
        .includes("random()"),
    );
    expect(jitterCall).toBeDefined();
  });

  it("deprioritises periodic dispatches so standard (initial) jobs preempt them", async () => {
    const { job, queue } = createJob({
      duePages: [[{ id: "conn-1", userId: "user-1" }]],
    });

    await job.handle();

    // BullMQ pops the standard wait list before the prioritised set, so the
    // periodic class must be the one carrying a priority value.
    expect(queue.add).toHaveBeenCalledWith(
      Jobs.ConnectorSync,
      expect.anything(),
      expect.objectContaining({ priority: expect.any(Number) }),
    );
  });
});
