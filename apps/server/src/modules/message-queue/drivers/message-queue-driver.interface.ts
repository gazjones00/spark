import type { Jobs, MessageQueue } from "../constants";
import type { KeepJobs, WorkerOptions as BullMQWorkerOptions } from "bullmq";

export interface MessageQueueJob<T = unknown> {
  id: string;
  name: Jobs;
  data: T;
}

export interface QueueJobOptions {
  jobId?: string;
  priority?: number;
  delay?: number;
  attempts?: number;
  removeOnComplete?: boolean | number | KeepJobs;
  removeOnFail?: boolean | number | KeepJobs;
  backoff?: {
    type: "exponential" | "fixed";
    delay: number;
  };
}
export type WorkerOptions = Pick<BullMQWorkerOptions, "concurrency">;

export interface MessageQueueDriver {
  register?(queueName: MessageQueue): void;

  add<T>(queueName: MessageQueue, jobName: Jobs, data: T, options?: QueueJobOptions): Promise<void>;

  addCron?<T>(
    queueName: MessageQueue,
    schedulerId: string,
    pattern: string,
    jobName: Jobs,
    data: T,
  ): Promise<void>;

  work<T>(
    queueName: MessageQueue,
    handler: (job: MessageQueueJob<T>) => Promise<void>,
    options?: WorkerOptions,
  ): void;

  close?(): Promise<void>;
}
