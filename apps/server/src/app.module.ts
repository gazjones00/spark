import { Module } from "@nestjs/common";
import { APP_GUARD, REQUEST } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { ORPCModule, onError } from "@orpc/nest";
import { AuthModule } from "@thallesp/nestjs-better-auth";
import { auth } from "@spark/auth/server";
import { env } from "@spark/env/server";
import type { Request } from "express";
import { LoggerModule } from "nestjs-pino";
import { AccountsModule } from "./modules/accounts";
import { ConnectorsModule } from "./modules/connectors";
import { CryptoModule } from "./modules/crypto";
import { HealthModule } from "./modules/health";
import { SettingsModule } from "./modules/settings";
import { TransactionsModule } from "./modules/transactions";
import { BullBoardModule } from "./modules/bull-board";
import { DatabaseModule } from "./modules/database";
import { createBullMQDriver, MessageQueueModule } from "./modules/message-queue";
import { rootLogger } from "./observability/logging.config";
import { reportError } from "./observability/sentry";
import { TruelayerModule } from "./providers/truelayer";
import { TruelayerController } from "./providers/truelayer/truelayer.controller";

declare module "@orpc/nest" {
  interface ORPCGlobalContext {
    request: Request;
  }
}

@Module({
  imports: [
    LoggerModule.forRoot({ pinoHttp: { logger: rootLogger } }),
    // Default rate limit for every Nest-routed endpoint (oRPC included).
    // Internal sync traffic is unaffected — the schedulers dispatch via the
    // queue, not HTTP. Disabled under test so suites aren't throttled.
    ThrottlerModule.forRoot({
      throttlers: [{ name: "default", ttl: 60_000, limit: 100 }],
      skipIf: () => env.NODE_ENV === "test",
    }),
    DatabaseModule,
    CryptoModule,
    // The driver is constructed inside the container so Nest owns its
    // lifecycle (onModuleDestroy drains queues/workers on shutdown).
    MessageQueueModule.registerAsync({
      useFactory: () => ({ driver: createBullMQDriver() }),
    }),
    ConnectorsModule,
    AccountsModule,
    TransactionsModule,
    SettingsModule,
    HealthModule,
    BullBoardModule.forRoot(),
    AuthModule.forRoot({ auth }),
    TruelayerModule.forRoot({
      environment: env.TRUELAYER_ENV,
      clientId: env.TRUELAYER_CLIENT_ID,
      clientSecret: env.TRUELAYER_CLIENT_SECRET,
      redirectUri: env.TRUELAYER_REDIRECT_URI,
    }),
    ORPCModule.forRootAsync({
      useFactory: (request: Request) => ({
        interceptors: [
          onError((error) => {
            // Log a normalised error shape only — the raw error object's
            // cause/response can carry OAuth tokens and the client secret
            // (the `err` serializer in logging.config strips those fields).
            rootLogger.error({ err: error }, "orpc handler error");
            const status = (error as { status?: number }).status;
            if (status === undefined || status >= 500) {
              reportError(error);
            }
          }),
        ],
        context: { request },
      }),
      inject: [REQUEST],
    }),
  ],
  controllers: [TruelayerController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
