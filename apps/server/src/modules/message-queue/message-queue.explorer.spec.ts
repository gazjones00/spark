import "reflect-metadata";
import { MetadataScanner, Reflector } from "@nestjs/core";
import { env } from "@spark/env/server";
import { UnrecoverableError } from "bullmq";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { Jobs, MessageQueue } from "./constants";
import { Cron, Process, Processor } from "./decorators";
import { JOB_SCHEMAS } from "./job-schemas";
import { MessageQueueMetadataAccessor } from "./message-queue-metadata.accessor";
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

describe("MessageQueueExplorer.explore (TASK-007 FR-6)", () => {
  @Processor(MessageQueue.DEFAULT)
  class TestProcessor {
    @Process(Jobs.AccountSync)
    async handleAccountSync(_data: unknown) {}

    @Process(Jobs.PeriodicSync)
    @Cron("*/5 * * * *")
    async handlePeriodicSync(_data: unknown) {}
  }

  function buildExplorer(instances: object[]) {
    const queueService = {
      work: vi.fn(),
      addCron: vi.fn().mockResolvedValue(undefined),
    };
    const moduleRef = { get: vi.fn().mockReturnValue(queueService) };
    const discovery = {
      getProviders: () =>
        instances.map((instance) => ({ metatype: instance.constructor, instance })),
    };
    const explorer = new MessageQueueExplorer(
      moduleRef as never,
      discovery as never,
      new MessageQueueMetadataAccessor(new Reflector()),
      new MetadataScanner(),
    );
    return { explorer, queueService, moduleRef };
  }

  it("registers the worker with the configured concurrency bound", async () => {
    const { explorer, queueService, moduleRef } = buildExplorer([new TestProcessor()]);

    await explorer.explore();

    expect(moduleRef.get).toHaveBeenCalledWith(`QUEUE_${MessageQueue.DEFAULT}`, {
      strict: false,
    });
    expect(queueService.work).toHaveBeenCalledTimes(1);
    expect(queueService.work).toHaveBeenCalledWith(expect.any(Function), {
      concurrency: env.WORKER_CONCURRENCY,
    });
  });

  it("registers cron jobs with the derived scheduler id", async () => {
    const { explorer, queueService } = buildExplorer([new TestProcessor()]);

    await explorer.explore();

    expect(queueService.addCron).toHaveBeenCalledTimes(1);
    expect(queueService.addCron).toHaveBeenCalledWith(
      "periodic-sync",
      "*/5 * * * *",
      Jobs.PeriodicSync,
      {},
    );
  });

  it("throws when two processors register the same job", async () => {
    @Processor(MessageQueue.DEFAULT)
    class DuplicateProcessor {
      @Process(Jobs.AccountSync)
      async handle(_data: unknown) {}
    }

    const { explorer } = buildExplorer([new TestProcessor(), new DuplicateProcessor()]);

    await expect(explorer.explore()).rejects.toThrow(
      `Duplicate job handler registered for "${Jobs.AccountSync}"`,
    );
  });
});
