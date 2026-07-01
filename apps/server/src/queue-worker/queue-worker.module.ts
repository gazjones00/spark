import { Module } from "@nestjs/common";
import { env } from "@spark/env/server";
import { LoggerModule } from "nestjs-pino";
import { JobsModule } from "../jobs/jobs.module";
import { DatabaseModule } from "../modules/database";
import { BullMQDriver, MessageQueueModule } from "../modules/message-queue";
import { rootLogger } from "../observability/logging.config";
import { reportError } from "../observability/sentry";
import { TruelayerModule } from "../providers/truelayer";
import { CryptoModule } from "../modules/crypto";

const driver = new BullMQDriver({
  connection: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
  },
  logger: rootLogger.child({ context: "BullMQDriver" }),
  onTerminalFailure: reportError,
});

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
    MessageQueueModule.register({ driver }),
    MessageQueueModule.registerExplorer(),
    JobsModule,
    CryptoModule,
  ],
})
export class QueueWorkerModule {}
