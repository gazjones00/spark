import type { MessageQueue } from "../constants";

export interface MessageQueueJob<T = unknown> {
  id: string;
  name: string;
  data: T;
}

export interface QueueJobOptions {
  priority?: number;
  delay?: number;
}

export interface WorkerOptions {
  concurrency?: number;
}

export interface MessageQueueDriver {
  register?(queueName: MessageQueue): void;

  add<T>(
    queueName: MessageQueue,
    jobName: string,
    data: T,
    options?: QueueJobOptions,
  ): Promise<void>;

  work<T>(
    queueName: MessageQueue,
    handler: (job: MessageQueueJob<T>) => Promise<void>,
    options?: WorkerOptions,
  ): void;

  close?(): Promise<void>;
}
