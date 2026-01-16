import type { Jobs, MessageQueue } from "../constants";
import type {
  MessageQueueDriver,
  MessageQueueJob,
  QueueJobOptions,
  WorkerOptions,
} from "./message-queue-driver.interface";

type JobHandler<T = unknown> = (job: MessageQueueJob<T>) => Promise<void>;

export class SyncDriver implements MessageQueueDriver {
  private handlers: Record<string, JobHandler> = {};
  private jobCounter = 0;

  register(_queueName: MessageQueue): void {
    // No-op for sync driver
  }

  async add<T>(
    queueName: MessageQueue,
    jobName: Jobs,
    data: T,
    _options?: QueueJobOptions,
  ): Promise<void> {
    const handler = this.handlers[queueName];
    if (!handler) {
      throw new Error(`No handler registered for queue "${queueName}"`);
    }

    const job: MessageQueueJob<T> = {
      id: String(++this.jobCounter),
      name: jobName,
      data,
    };
    await handler(job);
  }

  work<T>(
    queueName: MessageQueue,
    handler: (job: MessageQueueJob<T>) => Promise<void>,
    _options?: WorkerOptions,
  ): void {
    this.handlers[queueName] = handler as JobHandler;
  }

  async close(): Promise<void> {
    this.handlers = {};
  }
}
