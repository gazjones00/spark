import { UnrecoverableError } from "bullmq";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { Jobs } from "./constants";
import { JOB_SCHEMAS } from "./job-schemas";
import { MessageQueueExplorer } from "./message-queue.explorer";

describe("JOB_SCHEMAS", () => {
  it("has a schema for every Jobs enum value", () => {
    for (const job of Object.values(Jobs)) {
      expect(JOB_SCHEMAS[job]).toBeDefined();
    }
  });

  it("accepts a valid AccountSync payload", () => {
    const result = JOB_SCHEMAS[Jobs.AccountSync].safeParse({
      accountId: "acc-1",
      connectionId: "conn-1",
      accountType: "SAVINGS",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing/undefined ids and stale shapes", () => {
    expect(JOB_SCHEMAS[Jobs.AccountSync].safeParse({ accountId: undefined }).success).toBe(false);
    expect(
      JOB_SCHEMAS[Jobs.AccountSync].safeParse({ accountId: "", connectionId: "" }).success,
    ).toBe(false);
    expect(
      JOB_SCHEMAS[Jobs.AccountSync].safeParse({
        accountId: "acc-1",
        connectionId: "conn-1",
        legacyField: true,
      }).success,
    ).toBe(false);
    expect(
      JOB_SCHEMAS[Jobs.ConnectorSync].safeParse({ connection: "old-field-name" }).success,
    ).toBe(false);
    expect(
      JOB_SCHEMAS[Jobs.ConnectorSync].safeParse({
        connectionId: "conn-1",
        requestedAt: "not-a-date",
      }).success,
    ).toBe(false);
  });

  it("accepts the empty cron payload and rejects payloads with content", () => {
    expect(JOB_SCHEMAS[Jobs.PeriodicSync].safeParse({}).success).toBe(true);
    expect(JOB_SCHEMAS[Jobs.PeriodicSync].safeParse({ smuggled: true }).success).toBe(false);
  });
});

describe("MessageQueueExplorer.dispatch (TASK-006 FR-1)", () => {
  let explorer: MessageQueueExplorer;
  let handler: Mock<(data: unknown) => Promise<void>>;
  let handlers: Map<Jobs, (data: unknown) => Promise<void>>;

  beforeEach(() => {
    // dispatch() only uses the private logger; the injected services are
    // irrelevant to this path.
    explorer = new MessageQueueExplorer(null as never, null as never, null as never, null as never);
    handler = vi.fn().mockResolvedValue(undefined);
    handlers = new Map([[Jobs.AccountSync, handler]]);
  });

  it("runs the handler with the parsed payload when valid", async () => {
    await explorer.dispatch(handlers, {
      id: "job-1",
      name: Jobs.AccountSync,
      data: { accountId: "acc-1", connectionId: "conn-1" },
    });
    expect(handler).toHaveBeenCalledWith({ accountId: "acc-1", connectionId: "conn-1" });
  });

  it("throws UnrecoverableError (permanent, no retries) for invalid payloads", async () => {
    await expect(
      explorer.dispatch(handlers, {
        id: "job-2",
        name: Jobs.AccountSync,
        data: { accountId: undefined, connectionId: "conn-1" },
      }),
    ).rejects.toBeInstanceOf(UnrecoverableError);
    expect(handler).not.toHaveBeenCalled();
  });

  it("propagates handler failures as plain (retryable) errors", async () => {
    handler.mockRejectedValueOnce(new Error("transient"));
    const error = await explorer
      .dispatch(handlers, {
        id: "job-3",
        name: Jobs.AccountSync,
        data: { accountId: "acc-1", connectionId: "conn-1" },
      })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("transient");
    expect(error).not.toBeInstanceOf(UnrecoverableError);
  });

  it("warns and returns for unknown job names", async () => {
    await expect(
      explorer.dispatch(handlers, { id: "job-4", name: Jobs.ConnectorSync, data: {} }),
    ).resolves.toBeUndefined();
  });
});
