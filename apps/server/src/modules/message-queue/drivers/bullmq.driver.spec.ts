import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

const { queues, workers } = vi.hoisted(() => ({
  queues: [] as unknown[],
  workers: [] as unknown[],
}));

vi.mock("bullmq", () => {
  class FakeQueue extends EventEmitter {
    add = vi.fn().mockResolvedValue(undefined);
    close = vi.fn().mockResolvedValue(undefined);
    upsertJobScheduler = vi.fn().mockResolvedValue(undefined);
    constructor(
      public name: string,
      public opts: unknown,
    ) {
      super();
      queues.push(this);
    }
  }
  class FakeWorker extends EventEmitter {
    close = vi.fn().mockResolvedValue(undefined);
    constructor(
      public name: string,
      public processor: unknown,
      public opts: unknown,
    ) {
      super();
      workers.push(this);
    }
  }
  class UnrecoverableError extends Error {}
  return { Queue: FakeQueue, Worker: FakeWorker, UnrecoverableError };
});

import { UnrecoverableError } from "bullmq";
import { REDACTED } from "../../../observability/redaction";
import { MessageQueue } from "../constants";
import { BullMQDriver, type MessageQueueLogger } from "./bullmq.driver";

interface FakeQueueInstance {
  name: string;
  add: ReturnType<typeof vi.fn>;
}
interface FakeWorkerInstance extends EventEmitter {
  name: string;
}

function makeJob(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "job-1",
    name: "AccountSync",
    data: { accountId: "acc-1", connectionId: "conn-1" },
    attemptsMade: 1,
    opts: { attempts: 3 },
    ...overrides,
  };
}

async function flushAsync() {
  await new Promise((resolve) => setImmediate(resolve));
}

describe("BullMQDriver failure instrumentation", () => {
  let driver: BullMQDriver;
  let logger: MessageQueueLogger;
  let onTerminalFailure: Mock<(error: unknown, context: Record<string, unknown>) => void>;

  beforeEach(() => {
    queues.length = 0;
    workers.length = 0;
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    onTerminalFailure = vi.fn();
    driver = new BullMQDriver({
      connection: { host: "localhost", port: 6379 },
      logger,
      onTerminalFailure,
    });
    driver.register(MessageQueue.DEFAULT);
    driver.work(MessageQueue.DEFAULT, async () => {});
  });

  function worker(): FakeWorkerInstance {
    return workers[0] as FakeWorkerInstance;
  }

  function deadLetterQueue(): FakeQueueInstance | undefined {
    return queues.find((q) => (q as FakeQueueInstance).name === MessageQueue.DEAD_LETTER) as
      | FakeQueueInstance
      | undefined;
  }

  it("logs every failed attempt but only dead-letters the final one", async () => {
    worker().emit("failed", makeJob({ attemptsMade: 1 }), new Error("boom"));
    await flushAsync();
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(deadLetterQueue()?.add ?? deadLetterQueue()).toBeFalsy();
    expect(onTerminalFailure).not.toHaveBeenCalled();

    worker().emit("failed", makeJob({ attemptsMade: 3 }), new Error("boom"));
    await flushAsync();

    const dlq = deadLetterQueue();
    expect(dlq).toBeDefined();
    expect(dlq?.add).toHaveBeenCalledTimes(1);
    expect(onTerminalFailure).toHaveBeenCalledTimes(1);

    const [jobName, payload, opts] = dlq!.add.mock.calls[0];
    expect(jobName).toBe("AccountSync");
    expect(payload).toMatchObject({
      sourceQueue: MessageQueue.DEFAULT,
      jobId: "job-1",
      jobName: "AccountSync",
      attemptsMade: 3,
      error: { name: "Error", message: "boom" },
    });
    expect(payload.failedAt).toEqual(expect.any(String));
    // The DLQ itself must never retry (no amplification).
    expect(opts).toMatchObject({ attempts: 1, removeOnComplete: false });
  });

  it("treats UnrecoverableError as terminal even before retries are exhausted", async () => {
    worker().emit("failed", makeJob({ attemptsMade: 1 }), new UnrecoverableError("bad payload"));
    await flushAsync();
    expect(deadLetterQueue()?.add).toHaveBeenCalledTimes(1);
  });

  it("redacts sensitive fields from the dead-lettered payload", async () => {
    worker().emit(
      "failed",
      makeJob({
        attemptsMade: 3,
        data: { accountId: "acc-1", accessToken: "raw-token", nested: { refresh_token: "rt" } },
      }),
      new Error("boom"),
    );
    await flushAsync();

    const [, payload] = deadLetterQueue()!.add.mock.calls[0];
    expect(payload.data).toMatchObject({
      accountId: "acc-1",
      accessToken: REDACTED,
      nested: { refresh_token: REDACTED },
    });
    expect(JSON.stringify(payload)).not.toContain("raw-token");
  });

  it("normalises the stored error, dropping payload-bearing fields", async () => {
    const error = new Error("exchange failed") as Error & { response: unknown };
    error.response = { access_token: "leaky-token" };
    worker().emit("failed", makeJob({ attemptsMade: 3 }), error);
    await flushAsync();

    const [, payload] = deadLetterQueue()!.add.mock.calls[0];
    expect(JSON.stringify(payload)).not.toContain("leaky-token");
    expect(payload.error).toMatchObject({ name: "Error", message: "exchange failed" });
  });

  it("onModuleDestroy drains every queue and worker", async () => {
    await driver.onModuleDestroy();

    for (const queue of queues) {
      expect((queue as FakeQueueInstance & { close: Mock }).close).toHaveBeenCalledTimes(1);
    }
    expect((worker() as FakeWorkerInstance & { close: Mock }).close).toHaveBeenCalledTimes(1);
  });

  it("closes only once across repeated onModuleDestroy calls", async () => {
    await driver.onModuleDestroy();
    await driver.onModuleDestroy();

    expect((worker() as FakeWorkerInstance & { close: Mock }).close).toHaveBeenCalledTimes(1);
  });

  it("logs worker errors and stalled jobs", () => {
    worker().emit("error", new Error("redis gone"));
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        queue: MessageQueue.DEFAULT,
        err: expect.objectContaining({ message: "redis gone" }),
      }),
      "worker error",
    );

    worker().emit("stalled", "job-9");
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ queue: MessageQueue.DEFAULT, jobId: "job-9" }),
      "job stalled",
    );
  });
});
