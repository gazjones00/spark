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
import { DatabaseModule } from "./modules/database";
import { TruelayerModule } from "./providers/truelayer";
import { TruelayerController } from "./providers/truelayer/truelayer.controller";

declare module "@orpc/nest" {
  interface ORPCGlobalContext {
    request: Request;
  }
}

@Module({
  imports: [
    DatabaseModule,
    AccountsModule,
    AuthModule.forRoot({ auth }),
    TruelayerModule.forRoot({
      environment: "production",
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
