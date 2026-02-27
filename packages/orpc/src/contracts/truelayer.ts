import { oc } from "@orpc/contract";
import {
  AuthLinkResponseSchema,
  ExchangeCodeInputSchema,
  ExchangeCodeResponseSchema,
  GenerateAuthLinkInputSchema,
  SaveAccountsInputSchema,
  SaveAccountsResponseSchema,
} from "@spark/schema";

export const truelayerRouter = oc.router({
  generateAuthLink: oc
    .route({
      method: "POST",
      path: "/truelayer/auth-link",
    })
    .input(GenerateAuthLinkInputSchema)
    .output(AuthLinkResponseSchema),

  exchangeCode: oc
    .route({
      method: "POST",
      path: "/truelayer/exchange-code",
    })
    .input(ExchangeCodeInputSchema)
    .output(ExchangeCodeResponseSchema),

  saveAccounts: oc
    .route({
      method: "POST",
      path: "/truelayer/save-accounts",
    })
    .input(SaveAccountsInputSchema)
    .output(SaveAccountsResponseSchema),
});
