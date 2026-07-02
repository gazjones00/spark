import { Module } from "@nestjs/common";
import { env } from "@spark/env/server";
import { LoggerModule } from "nestjs-pino";
import { JobsModule } from "../jobs/jobs.module";
import { DatabaseModule } from "../modules/database";
import { createBullMQDriver, MessageQueueModule } from "../modules/message-queue";
import { rootLogger } from "../observability/logging.config";
import { TruelayerModule } from "../providers/truelayer";
import { CryptoModule } from "../modules/crypto";

@Module({
  imports: [
    LoggerModule.forRoot({ pinoHttp: { logger: rootLogger } }),
    DatabaseModule,
    TruelayerModule.forRoot({
      environment: env.TRUELAYER_ENV,
      clientId: env.TRUELAYER_CLIENT_ID,
      clientSecret: env.TRUELAYER_CLIENT_SECRET,
      redirectUri: env.TRUELAYER_REDIRECT_URI,
    }),
    MessageQueueModule.registerAsync({
      useFactory: () => ({ driver: createBullMQDriver() }),
    }),
    MessageQueueModule.registerExplorer(),
    JobsModule,
    CryptoModule,
  ],
})
export class QueueWorkerModule {}
