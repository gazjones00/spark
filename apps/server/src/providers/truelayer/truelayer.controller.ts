import { BadRequestException, Controller, Get, Query, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Implement, implement } from "@orpc/nest";
import { AllowAnonymous, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { contract } from "@spark/orpc/contract";
import type { Response } from "express";
import { TruelayerCallbackQuerySchema } from "@spark/schema";
import { InvalidOauthStateError, TruelayerService } from "./truelayer.service";

@Controller()
export class TruelayerController {
  constructor(private readonly truelayerService: TruelayerService) {}

  /**
   * The one deliberate non-oRPC HTTP edge: oRPC cannot serve a 302 redirect.
   * Public (@AllowAnonymous) and internet-facing, so it carries a stricter
   * rate limit than the global default, and validates its input with a
   * single explicit Zod parse — oRPC `.input()` schemas are the contract
   * boundary everywhere else.
   */
  @Get("truelayer/callback")
  @AllowAnonymous()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  callback(@Query() query: unknown, @Res() res: Response) {
    const parsed = TruelayerCallbackQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException("Invalid callback parameters");
    }
    const redirectUrl = this.truelayerService.buildCallbackRedirectUrl(
      parsed.data.code,
      parsed.data.state,
    );
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
    return implement(contract.truelayer.exchangeCode).handler(async ({ input, errors }) => {
      try {
        return await this.truelayerService.exchangeCode({
          code: input.code,
          state: input.state,
          userId: session.user.id,
        });
      } catch (error) {
        if (error instanceof InvalidOauthStateError) {
          // Contract default message only — error.message carries internal
          // detail (e.g. token-storage failures) that must not reach clients.
          throw errors.INVALID_OAUTH_STATE({ cause: error });
        }
        throw error;
      }
    });
  }

  @Implement(contract.truelayer.saveAccounts)
  saveAccounts(@Session() session: UserSession) {
    return implement(contract.truelayer.saveAccounts).handler(async ({ input, errors }) => {
      try {
        return await this.truelayerService.saveAccounts({
          state: input.state,
          accountIds: input.accountIds,
          userId: session.user.id,
        });
      } catch (error) {
        if (error instanceof InvalidOauthStateError) {
          throw errors.INVALID_OAUTH_STATE({ cause: error });
        }
        throw error;
      }
    });
  }
}
