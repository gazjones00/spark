import { Queue, Worker } from "bullmq";
import type { Jobs, MessageQueue } from "../constants";
import type {
  MessageQueueDriver,
  MessageQueueJob,
  QueueJobOptions,
  WorkerOptions,
} from "./message-queue-driver.interface";

export interface BullMQDriverOptions {
  connection: {
    host: string;
    port: number;
  };
}

export class BullMQDriver implements MessageQueueDriver {
  private queueMap: Record<string, Queue> = {};
  private workerMap: Record<string, Worker> = {};

  constructor(private options: BullMQDriverOptions) {}

  register(queueName: MessageQueue): void {
    if (!this.queueMap[queueName]) {
      this.queueMap[queueName] = new Queue(queueName, this.options);
    }
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

    this.workerMap[queueName] = new Worker(
      queueName,
      async (job) => {
        await handler({
          id: job.id ?? "",
          name: job.name as Jobs,
          data: job.data as T,
        });
      },
      { ...this.options, ...options },
    );
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
}
