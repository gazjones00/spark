import { oc } from "@orpc/contract";
import {
  AuthLinkResponseSchema,
  ExchangeCodeInputSchema,
  ExchangeCodeResponseSchema,
  GenerateAuthLinkInputSchema,
  SaveAccountsInputSchema,
  SaveAccountsResponseSchema,
} from "@spark/schema";

// The OAuth state row expires 10 minutes after the auth link is generated;
// a stale/invalid state is user-recoverable by restarting the connect flow.
const oauthStateErrors = {
  INVALID_OAUTH_STATE: {
    status: 401,
    message: "Your bank connection session is invalid or has expired.",
  },
} as const;

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
    .errors(oauthStateErrors)
    .input(ExchangeCodeInputSchema)
    .output(ExchangeCodeResponseSchema),

  saveAccounts: oc
    .route({
      method: "POST",
      path: "/truelayer/save-accounts",
    })
    .errors(oauthStateErrors)
    .input(SaveAccountsInputSchema)
    .output(SaveAccountsResponseSchema),
});
