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

// Settings API Schemas

export const ChangePasswordInputSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
});

export const ChangePasswordResponseSchema = z.object({
  success: z.boolean(),
});

export const NotificationPreferencesSchema = z.object({
  largeTransactions: z.boolean(),
  lowBalance: z.boolean(),
  budgetOverspend: z.boolean(),
  syncFailures: z.boolean(),
});

export const UpdateNotificationPreferencesInputSchema = z.object({
  largeTransactions: z.boolean().optional(),
  lowBalance: z.boolean().optional(),
  budgetOverspend: z.boolean().optional(),
  syncFailures: z.boolean().optional(),
});

export const ThemeSchema = z.enum(["system", "light", "dark"]);

export const UserPreferencesSchema = z.object({
  displayCurrency: z.string(),
  theme: ThemeSchema,
});

export const UpdateUserPreferencesInputSchema = z.object({
  displayCurrency: z.string().optional(),
  theme: ThemeSchema.optional(),
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

  settings: oc.router({
    getNotificationPreferences: oc
      .route({
        method: "GET",
        path: "/settings/notifications",
      })
      .output(NotificationPreferencesSchema),

    updateNotificationPreferences: oc
      .route({
        method: "PATCH",
        path: "/settings/notifications",
      })
      .input(UpdateNotificationPreferencesInputSchema)
      .output(NotificationPreferencesSchema),

    getUserPreferences: oc
      .route({
        method: "GET",
        path: "/settings/preferences",
      })
      .output(UserPreferencesSchema),

    updateUserPreferences: oc
      .route({
        method: "PATCH",
        path: "/settings/preferences",
      })
      .input(UpdateUserPreferencesInputSchema)
      .output(UserPreferencesSchema),
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
