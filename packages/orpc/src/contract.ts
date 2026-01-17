import { oc } from "@orpc/contract";
import {
  AccountNumberSchema,
  AccountProviderSchema,
  AccountSchema,
  AccountTypeSchema,
  CurrencySchema,
} from "@spark/truelayer/schemas";
import { z } from "zod";

export const HelloResponseSchema = z.object({
  message: z.string(),
});

export const AuthLinkResponseSchema = z.object({
  url: z.string(),
  state: z.string(),
});

// TrueLayer API Schemas

export const GenerateAuthLinkInputSchema = z.object({
  providerId: z.string().optional(),
});

export const ExchangeCodeInputSchema = z.object({
  code: z.string(),
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

// ============================================================================
// Accounts API Schemas - Extends domain schemas for API-specific fields
// ============================================================================

export const SavedAccountSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  accountType: AccountTypeSchema.nullable(),
  displayName: z.string(),
  currency: CurrencySchema,
  accountNumber: AccountNumberSchema,
  provider: AccountProviderSchema,
  updatedAt: z.string(),
  currentBalance: z.string().nullable(),
  availableBalance: z.string().nullable(),
  overdraft: z.string().nullable(),
  balanceUpdatedAt: z.string().nullable(),
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

// API Contract

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

export type Account = z.infer<typeof SavedAccountSchema>;

export {
  AccountNumberSchema,
  AccountProviderSchema,
  AccountSchema,
  AccountTypeSchema,
  CurrencySchema,
} from "@spark/truelayer/schemas";
