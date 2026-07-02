import { truelayerOauthStates } from "@spark/db/schema";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the query-builder helpers so we can assert on how the expiry
// predicate is constructed without standing up a real database.
vi.mock("@spark/db", () => ({
  inArray: vi.fn((column: unknown, values: unknown) => ({ __inArray: { column, values } })),
  lt: vi.fn((column: unknown, value: unknown) => ({ __lt: { column, value } })),
  sql: vi.fn(() => ({ __sql: true })),
}));

import { lt } from "@spark/db";
import { OauthStateCleanupJob } from "./oauth-state-cleanup.job";

function createJob(pages: string[][]) {
  let call = 0;
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() => {
      const page = pages[call] ?? [];
      call += 1;
      return Promise.resolve(page.map((state) => ({ state })));
    }),
  };
  const deleteChain = {
    where: vi.fn().mockReturnThis(),
    returning: vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve((pages[call - 1] ?? []).map((state) => ({ state }))),
      ),
  };
  const tx = {
    execute: vi.fn().mockResolvedValue({ rows: [{ locked: true }] }),
    select: vi.fn(() => selectChain),
    delete: vi.fn(() => deleteChain),
  };
  const db = {
    transaction: vi.fn(async (cb: (txArg: unknown) => unknown) => cb(tx)),
  };

  const job = new OauthStateCleanupJob(db as never);
  return { job, db, tx, selectChain, deleteChain };
}

describe("OauthStateCleanupJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes only rows expired for longer than the safety buffer", async () => {
    const { job, tx, deleteChain } = createJob([["state-1", "state-2"]]);

    await job.handle();

    // The cutoff sits a full buffer behind now, so a just-expired row (or an
    // in-flight flow racing the boundary) is never swept.
    const cutoffCall = vi
      .mocked(lt)
      .mock.calls.find((callArgs) => callArgs[0] === truelayerOauthStates.expiresAt);
    expect(cutoffCall).toBeDefined();
    const cutoff = cutoffCall?.[1] as Date;
    expect(cutoff.getTime()).toBeLessThanOrEqual(Date.now() - 59 * 60 * 1000);

    expect(tx.delete).toHaveBeenCalledTimes(1);
    expect(deleteChain.returning).toHaveBeenCalledTimes(1);
  });

  it("issues no delete when nothing is expired", async () => {
    const { job, tx } = createJob([[]]);

    await job.handle();

    expect(tx.select).toHaveBeenCalledTimes(1);
    expect(tx.delete).not.toHaveBeenCalled();
  });

  it("keeps deleting in batches until a short page signals the backlog is drained", async () => {
    const fullPage = Array.from({ length: 500 }, (_, index) => `state-${index}`);
    const { job, tx } = createJob([fullPage, ["state-tail"]]);

    await job.handle();

    expect(tx.delete).toHaveBeenCalledTimes(2);
  });

  it("skips the run when the sweeper lock is not acquired", async () => {
    const { job, tx } = createJob([["state-1"]]);
    tx.execute.mockResolvedValueOnce({ rows: [{ locked: false }] });

    await job.handle();

    expect(tx.select).not.toHaveBeenCalled();
    expect(tx.delete).not.toHaveBeenCalled();
  });
});
