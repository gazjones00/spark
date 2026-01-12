import { oc } from "@orpc/contract";
import { z } from "zod";

export const HelloResponseSchema = z.object({
  message: z.string(),
});

export const AuthLinkResponseSchema = z.object({
  url: z.string(),
  state: z.string(),
});

export const GenerateAuthLinkInputSchema = z.object({
  providerId: z.string().optional(),
});

export const ExchangeCodeInputSchema = z.object({
  code: z.string(),
});

export const AccountNumberSchema = z.object({
  number: z.string().optional(),
  sortCode: z.string().optional(),
  swiftBic: z.string().optional(),
  iban: z.string().optional(),
  routingNumber: z.string().optional(),
  bsb: z.string().optional(),
});

export const AccountProviderSchema = z.object({
  providerId: z.string().optional(),
  logoUri: z.string().optional(),
  displayName: z.string().optional(),
});

export const AccountSchema = z.object({
  updateTimestamp: z.string(),
  accountId: z.string(),
  accountType: z
    .enum(["TRANSACTION", "SAVINGS", "BUSINESS_TRANSACTION", "BUSINESS_SAVINGS"])
    .optional(),
  displayName: z.string(),
  currency: z.enum(["EUR", "GBP", "USD", "AUD"]),
  accountNumber: AccountNumberSchema,
  provider: AccountProviderSchema,
});

export const ExchangeCodeResponseSchema = z.object({
  accessToken: z.string(),
  expiresAt: z.string(),
  refreshToken: z.string().nullable(),
  accounts: z.array(AccountSchema),
});

export const SaveAccountsInputSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().nullable(),
  expiresAt: z.string(),
  accountIds: z.array(z.string()),
});

export const SaveAccountsResponseSchema = z.object({
  savedCount: z.number(),
});

export const SavedAccountSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  accountType: z
    .enum(["TRANSACTION", "SAVINGS", "BUSINESS_TRANSACTION", "BUSINESS_SAVINGS"])
    .nullable(),
  displayName: z.string(),
  currency: z.enum(["EUR", "GBP", "USD", "AUD"]),
  accountNumber: AccountNumberSchema,
  provider: AccountProviderSchema,
  updateTimestamp: z.string(),
});

export const GetAccountsResponseSchema = z.object({
  accounts: z.array(SavedAccountSchema),
});

export const UpdateAccountInputSchema = z.object({
  id: z.string(),
  displayName: z.string().optional(),
});

export const UpdateAccountResponseSchema = z.object({
  account: SavedAccountSchema,
});

export const DeleteAccountInputSchema = z.object({
  id: z.string(),
});

export const DeleteAccountResponseSchema = z.object({
  success: z.boolean(),
});

export const contract = oc.router({
  health: oc
    .route({
      method: "GET",
      path: "/health",
    })
    .output(HelloResponseSchema),

  truelayer: oc.router({
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
  }),

  accounts: oc.router({
    list: oc
      .route({
        method: "GET",
        path: "/accounts",
      })
      .output(GetAccountsResponseSchema),

    update: oc
      .route({
        method: "PATCH",
        path: "/accounts/{id}",
      })
      .input(UpdateAccountInputSchema)
      .output(UpdateAccountResponseSchema),

    delete: oc
      .route({
        method: "DELETE",
        path: "/accounts/{id}",
      })
      .input(DeleteAccountInputSchema)
      .output(DeleteAccountResponseSchema),
  }),
});

export type Contract = typeof contract;
