import { Module } from "@nestjs/common";
import { env } from "@spark/env/server";
import { JobsModule } from "../jobs/jobs.module";
import { BullMQDriver, MessageQueueModule } from "../modules/message-queue";

const driver = new BullMQDriver({
  connection: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
  },
});

@Module({
  imports: [MessageQueueModule.registerWorker({ driver }), JobsModule],
})
export class QueueWorkerModule {}
