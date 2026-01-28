import { oc } from "@orpc/contract";
import { AccountSchema } from "@spark/truelayer/schemas";
import { z } from "zod";

export const AuthLinkResponseSchema = z.object({
  url: z.string(),
  state: z.string(),
});

export const GenerateAuthLinkInputSchema = z.object({
  providerId: z.string().optional(),
});

export const ExchangeCodeInputSchema = z.object({
  code: z.string(),
  state: z.string(),
});

export const ExchangeCodeResponseSchema = z.object({
  state: z.string(),
  accounts: z.array(AccountSchema),
});

export const SaveAccountsInputSchema = z.object({
  state: z.string(),
  accountIds: z.array(z.string()),
});

export const SaveAccountsResponseSchema = z.object({
  savedCount: z.number(),
});

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
