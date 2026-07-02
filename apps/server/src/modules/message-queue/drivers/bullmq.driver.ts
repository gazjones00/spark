import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { type Job, Queue, UnrecoverableError, Worker } from "bullmq";
import { normalizeError, redactSensitive } from "../../../observability/redaction";
import { type Jobs, MessageQueue } from "../constants";
import type {
  MessageQueueDriver,
  MessageQueueJob,
  QueueJobOptions,
  WorkerOptions,
} from "./message-queue-driver.interface";

/** Minimal structured-logger surface; satisfied by a pino logger. */
export interface MessageQueueLogger {
  info(obj: Record<string, unknown>, msg?: string): void;
  warn(obj: Record<string, unknown>, msg?: string): void;
  error(obj: Record<string, unknown>, msg?: string): void;
}

export interface BullMQDriverOptions {
  connection: {
    host: string;
    port: number;
  };
  logger?: MessageQueueLogger;
  /** Invoked once per terminally-failed job (e.g. to report to Sentry). */
  onTerminalFailure?: (error: unknown, context: Record<string, unknown>) => void;
}

@Injectable()
export class BullMQDriver implements MessageQueueDriver, OnModuleDestroy {
  private queueMap: Record<string, Queue> = {};
  private workerMap: Record<string, Worker> = {};
  private closePromise?: Promise<void>;
  private readonly connection: BullMQDriverOptions["connection"];
  private readonly logger?: MessageQueueLogger;
  private readonly onTerminalFailure?: BullMQDriverOptions["onTerminalFailure"];

  constructor(options: BullMQDriverOptions) {
    this.connection = options.connection;
    this.logger = options.logger;
    this.onTerminalFailure = options.onTerminalFailure;
  }

  register(queueName: MessageQueue): void {
    if (!this.queueMap[queueName]) {
      this.queueMap[queueName] = this.createQueue(queueName);
    }
  }

  private createQueue(queueName: MessageQueue): Queue {
    const queue = new Queue(queueName, { connection: this.connection });
    // Without a listener, connection failures surface as unhandled 'error'
    // events and dump raw objects to stderr.
    queue.on("error", (error) => {
      this.logger?.error({ queue: queueName, err: normalizeError(error) }, "queue error");
    });
    return queue;
  }

  async add<T>(
    queueName: MessageQueue,
    jobName: Jobs,
    data: T,
    options?: QueueJobOptions,
  ): Promise<void> {
    const queue = this.queueMap[queueName];
    if (!queue) {
      throw new Error(`Queue "${queueName}" not registered. Call register() first.`);
    }
    await queue.add(jobName, data, {
      ...options,
      attempts: options?.attempts ?? 3,
      backoff: options?.backoff ?? { type: "exponential", delay: 1000 },
      removeOnComplete: options?.removeOnComplete ?? { count: 1000 },
      removeOnFail: options?.removeOnFail ?? { count: 5000 },
    });
  }

  async addCron<T>(
    queueName: MessageQueue,
    schedulerId: string,
    pattern: string,
    jobName: Jobs,
    data: T,
  ): Promise<void> {
    const queue = this.queueMap[queueName];
    if (!queue) {
      throw new Error(`Queue "${queueName}" not registered. Call register() first.`);
    }
    await queue.upsertJobScheduler(schedulerId, { pattern }, { name: jobName, data });
  }

  work<T>(
    queueName: MessageQueue,
    handler: (job: MessageQueueJob<T>) => Promise<void>,
    options?: WorkerOptions,
  ): void {
    if (this.workerMap[queueName]) {
      throw new Error(`Worker for queue "${queueName}" already exists.`);
    }

    const worker = new Worker(
      queueName,
      async (job) => {
        await handler({
          id: job.id ?? "",
          name: job.name as Jobs,
          data: job.data as T,
        });
      },
      { connection: this.connection, ...options },
    );

    worker.on("failed", (job, error) => {
      this.logger?.error(
        {
          queue: queueName,
          jobId: job?.id,
          jobName: job?.name,
          attemptsMade: job?.attemptsMade,
          err: normalizeError(error),
        },
        "job failed",
      );
      if (job && this.isTerminalFailure(job, error)) {
        void this.deadLetter(queueName, job, error);
      }
    });
    worker.on("error", (error) => {
      this.logger?.error({ queue: queueName, err: normalizeError(error) }, "worker error");
    });
    worker.on("stalled", (jobId) => {
      this.logger?.warn({ queue: queueName, jobId }, "job stalled");
    });

    this.workerMap[queueName] = worker;
  }

  /**
   * Drain queues and workers when the Nest container shuts down (worker
   * `app.close()` on SIGINT/SIGTERM, API via `enableShutdownHooks()`), so
   * in-flight jobs finish instead of being force-killed mid-sync. Guarded
   * so an aliasing provider (e.g. Bull Board's `useExisting`) can't drain
   * twice.
   */
  onModuleDestroy(): Promise<void> {
    this.closePromise ??= this.close();
    return this.closePromise;
  }

  async close(): Promise<void> {
    const closePromises: Promise<void>[] = [];

    for (const queue of Object.values(this.queueMap)) {
      closePromises.push(queue.close());
    }

    for (const worker of Object.values(this.workerMap)) {
      closePromises.push(worker.close());
    }

    await Promise.all(closePromises);
  }

  getQueues(): Queue[] {
    return Object.values(this.queueMap);
  }

  /**
   * Final retry exhausted, or the handler flagged the job as permanently
   * unprocessable (BullMQ skips remaining attempts on UnrecoverableError).
   */
  private isTerminalFailure(job: Job, error: unknown): boolean {
    return job.attemptsMade >= (job.opts.attempts ?? 1) || error instanceof UnrecoverableError;
  }

  private deadLetterQueue(): Queue {
    if (!this.queueMap[MessageQueue.DEAD_LETTER]) {
      this.queueMap[MessageQueue.DEAD_LETTER] = this.createQueue(MessageQueue.DEAD_LETTER);
    }
    return this.queueMap[MessageQueue.DEAD_LETTER];
  }

  private async deadLetter(sourceQueue: MessageQueue, job: Job, error: unknown): Promise<void> {
    const normalized = normalizeError(error);
    try {
      // attempts: 1 so the DLQ itself never retries (no amplification);
      // entries are kept until handled by an operator.
      await this.deadLetterQueue().add(
        job.name,
        {
          sourceQueue,
          jobId: job.id,
          jobName: job.name,
          attemptsMade: job.attemptsMade,
          failedAt: new Date().toISOString(),
          data: redactSensitive(job.data),
          error: {
            name: normalized.name,
            message: normalized.message,
            ...(normalized.code !== undefined ? { code: normalized.code } : {}),
            ...(normalized.status !== undefined ? { status: normalized.status } : {}),
          },
        },
        { attempts: 1, removeOnComplete: false, removeOnFail: false },
      );
      this.onTerminalFailure?.(error, {
        sourceQueue,
        jobId: job.id,
        jobName: job.name,
        attemptsMade: job.attemptsMade,
      });
    } catch (dlqError) {
      this.logger?.error(
        { queue: sourceQueue, jobId: job.id, err: normalizeError(dlqError) },
        "failed to write dead-letter entry",
      );
    }
  }
}
