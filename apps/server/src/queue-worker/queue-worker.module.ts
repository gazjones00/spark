import { Module } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";
import { JobsModule } from "../jobs/jobs.module";
import { DatabaseModule } from "../modules/database";
import { createBullMQDriver, MessageQueueModule } from "../modules/message-queue";
import { rootLogger } from "../observability/logging.config";
import { CryptoModule } from "../modules/crypto";

@Module({
  imports: [
    LoggerModule.forRoot({ pinoHttp: { logger: rootLogger } }),
    DatabaseModule,
    MessageQueueModule.registerAsync({
      useFactory: () => ({ driver: createBullMQDriver() }),
    }),
    MessageQueueModule.registerExplorer(),
    JobsModule,
    CryptoModule,
  ],
})
export class QueueWorkerModule {}
