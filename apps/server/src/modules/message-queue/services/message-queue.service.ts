import { Inject, Injectable } from "@nestjs/common";
import { type Jobs, type MessageQueue, QUEUE_DRIVER } from "../constants";
import type {
  MessageQueueDriver,
  MessageQueueJob,
  QueueJobOptions,
  WorkerOptions,
} from "../drivers/message-queue-driver.interface";

@Injectable()
export class MessageQueueService {
  constructor(
    @Inject(QUEUE_DRIVER) protected driver: MessageQueueDriver,
    protected queueName: MessageQueue,
  ) {
    this.driver.register?.(queueName);
  }

  add<T>(jobName: Jobs, data: T, options?: QueueJobOptions): Promise<void> {
    return this.driver.add(this.queueName, jobName, data, options);
  }

  addCron<T>(schedulerId: string, pattern: string, jobName: Jobs, data: T): Promise<void> {
    if (!this.driver.addCron) {
      throw new Error("addCron is not supported by this driver");
    }
    return this.driver.addCron(this.queueName, schedulerId, pattern, jobName, data);
  }

  work<T>(handler: (job: MessageQueueJob<T>) => Promise<void>, options?: WorkerOptions): void {
    return this.driver.work(this.queueName, handler, options);
  }
}
