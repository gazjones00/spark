import { Inject, Injectable } from "@nestjs/common";
import { type MessageQueue, QUEUE_DRIVER } from "../constants";
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

  add<T>(jobName: string, data: T, options?: QueueJobOptions): Promise<void> {
    return this.driver.add(this.queueName, jobName, data, options);
  }

  work<T>(handler: (job: MessageQueueJob<T>) => Promise<void>, options?: WorkerOptions): void {
    return this.driver.work(this.queueName, handler, options);
  }
}
