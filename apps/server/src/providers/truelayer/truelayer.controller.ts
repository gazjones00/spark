import { Controller, Get, Query, Res } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { AllowAnonymous, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { contract } from "@spark/orpc/contract";
import type { Response } from "express";
import { TruelayerService } from "./truelayer.service";

@Controller()
export class TruelayerController {
  constructor(private readonly truelayerService: TruelayerService) {}

  @Get("truelayer/callback")
  @AllowAnonymous()
  callback(@Query("code") code: string, @Query("state") state: string, @Res() res: Response) {
    const redirectUrl = this.truelayerService.buildCallbackRedirectUrl(code, state);
    return res.redirect(redirectUrl);
  }

  @Implement(contract.truelayer.generateAuthLink)
  generateAuthLink(@Session() session: UserSession) {
    return implement(contract.truelayer.generateAuthLink).handler(({ input }) => {
      return this.truelayerService.generateAuthLink({
        providerId: input.providerId,
        userId: session.user.id,
      });
    });
  }

  @Implement(contract.truelayer.exchangeCode)
  exchangeCode(@Session() session: UserSession) {
    return implement(contract.truelayer.exchangeCode).handler(({ input }) => {
      return this.truelayerService.exchangeCode({
        code: input.code,
        state: input.state,
        userId: session.user.id,
      });
    });
  }

  @Implement(contract.truelayer.saveAccounts)
  saveAccounts(@Session() session: UserSession) {
    return implement(contract.truelayer.saveAccounts).handler(({ input }) => {
      return this.truelayerService.saveAccounts({
        state: input.state,
        accountIds: input.accountIds,
        userId: session.user.id,
      });
    });
  }
}
