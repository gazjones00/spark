import { Module } from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import { ORPCModule, onError } from "@orpc/nest";
import { AuthModule } from "@thallesp/nestjs-better-auth";
import { auth } from "@spark/auth/server";
import { env } from "@spark/env/server";
import type { Request } from "express";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AccountsModule } from "./modules/accounts";
import { CryptoModule } from "./modules/crypto";
import { SettingsModule } from "./modules/settings";
import { TransactionsModule } from "./modules/transactions";
import { BullBoardModule } from "./modules/bull-board";
import { DatabaseModule } from "./modules/database";
import { BullMQDriver, MessageQueueModule } from "./modules/message-queue";
import { TruelayerModule } from "./providers/truelayer";
import { TruelayerController } from "./providers/truelayer/truelayer.controller";

declare module "@orpc/nest" {
  interface ORPCGlobalContext {
    request: Request;
  }
}

const messageQueueDriver = new BullMQDriver({
  connection: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
  },
});

@Module({
  imports: [
    DatabaseModule,
    CryptoModule,
    AccountsModule,
    TransactionsModule,
    SettingsModule,
    MessageQueueModule.register({ driver: messageQueueDriver }),
    BullBoardModule.forRoot(messageQueueDriver),
    // TODO: set up logger module and assign log: () => LoggerService
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
            console.error(error);
          }),
        ],
        context: { request },
      }),
      inject: [REQUEST],
    }),
  ],
  controllers: [AppController, TruelayerController],
  providers: [AppService],
})
export class AppModule {}
