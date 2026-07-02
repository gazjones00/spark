import { connectorConnections } from "@spark/db/schema";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the query-builder helpers so we can assert on how the selection
// predicate is constructed without standing up a real database.
vi.mock("@spark/db", () => ({
  and: vi.fn((...args: unknown[]) => ({ __and: args })),
  or: vi.fn((...args: unknown[]) => ({ __or: args })),
  inArray: vi.fn((column: unknown, values: unknown) => ({ __inArray: { column, values } })),
  isNull: vi.fn((column: unknown) => ({ __isNull: column })),
  isNotNull: vi.fn((column: unknown) => ({ __isNotNull: column })),
  lt: vi.fn((left: unknown, right: unknown) => ({ __lt: { left, right } })),
  lte: vi.fn((column: unknown, value: unknown) => ({ __lte: { column, value } })),
  sql: vi.fn(() => ({ __sql: true })),
}));

import { isNotNull, isNull, lt, lte, or } from "@spark/db";
import { Jobs } from "../modules/message-queue";
import { ConsentLifecycleJob } from "./consent-lifecycle.job";

interface ExpiringRow {
  id: string;
  userId: string;
  providerId: string;
  providerName: string;
  consentExpiresAt: Date | null;
  consentGrantedAt: Date | null;
}

function makeRow(overrides: Partial<ExpiringRow> = {}): ExpiringRow {
  return {
    id: "conn-1",
    userId: "user-1",
    providerId: "truelayer",
    providerName: "TrueLayer",
    consentExpiresAt: new Date("2026-07-10T00:00:00.000Z"),
    consentGrantedAt: new Date("2026-04-11T00:00:00.000Z"),
    ...overrides,
  };
}

function createJob({ due, locked = true }: { due: ExpiringRow[]; locked?: boolean }) {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(due),
  };
  const updateChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };
  const tx = {
    execute: vi.fn().mockResolvedValue({ rows: [{ locked }] }),
    select: vi.fn(() => selectChain),
    update: vi.fn(() => updateChain),
  };
  const db = {
    transaction: vi.fn(async (cb: (txArg: unknown) => unknown) => cb(tx)),
  };
  const queue = {
    add: vi.fn<(name: unknown, data: unknown, opts?: { jobId?: string }) => Promise<void>>(
      async () => undefined,
    ),
  };

  const job = new ConsentLifecycleJob(db as never, queue as never);
  return { job, queue, tx, updateChain };
}

describe("ConsentLifecycleJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("selects only connections with a known expiry inside the window and no warning this cycle", async () => {
    const { job } = createJob({ due: [makeRow()] });

    await job.handle();

    // Unknown lifetime (null expiry) is never flagged.
    expect(isNotNull).toHaveBeenCalledWith(connectorConnections.consentExpiresAt);
    // Expiry gated to now + warning window.
    expect(lte).toHaveBeenCalledWith(connectorConnections.consentExpiresAt, expect.any(Date));
    // Idempotence across cycles: unwarned, or warned in a previous consent
    // cycle (stamp older than the current grant).
    expect(isNull).toHaveBeenCalledWith(connectorConnections.consentWarningIssuedAt);
    expect(lt).toHaveBeenCalledWith(
      connectorConnections.consentWarningIssuedAt,
      connectorConnections.consentGrantedAt,
    );
    expect(or).toHaveBeenCalled();
  });

  it("stamps consentWarningIssuedAt and enqueues one consent.expiring event per connection", async () => {
    const rows = [makeRow(), makeRow({ id: "conn-2", userId: "user-2" })];
    const { job, queue, tx, updateChain } = createJob({ due: rows });

    await job.handle();

    expect(tx.update).toHaveBeenCalledWith(connectorConnections);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ consentWarningIssuedAt: expect.any(Date) }),
    );

    expect(queue.add).toHaveBeenCalledTimes(2);
    const [jobName, payload, options] = queue.add.mock.calls[0];
    expect(jobName).toBe(Jobs.ConsentExpiring);
    expect(payload).toEqual({
      userId: "user-1",
      connectionId: "conn-1",
      providerId: "truelayer",
      providerName: "TrueLayer",
      consentExpiresAt: "2026-07-10T00:00:00.000Z",
    });
    // The jobId keys on connection + grant so re-enqueues within one consent
    // cycle dedupe at the queue, while a later cycle produces a distinct job.
    expect(options?.jobId).toBe(`consent-expiring:conn-1:${makeRow().consentGrantedAt?.getTime()}`);
  });

  it("emits no tokens or PII in the event payload", async () => {
    const { job, queue } = createJob({ due: [makeRow()] });

    await job.handle();

    const [, payload] = queue.add.mock.calls[0];
    expect(Object.keys(payload as Record<string, unknown>).sort()).toEqual([
      "connectionId",
      "consentExpiresAt",
      "providerId",
      "providerName",
      "userId",
    ]);
  });

  it("does nothing when the advisory lock is held by another instance", async () => {
    const { job, queue, tx } = createJob({ due: [makeRow()], locked: false });

    await job.handle();

    expect(tx.update).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it("does nothing when no connections are approaching expiry", async () => {
    const { job, queue, tx } = createJob({ due: [] });

    await job.handle();

    expect(tx.update).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it("logs the consumed consent.expiring event without touching the database", async () => {
    const { job, tx, queue } = createJob({ due: [] });

    await job.handleConsentExpiring({
      userId: "user-1",
      connectionId: "conn-1",
      providerId: "truelayer",
      providerName: "TrueLayer",
      consentExpiresAt: "2026-07-10T00:00:00.000Z",
    });

    expect(tx.select).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });
});
