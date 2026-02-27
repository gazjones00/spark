import { z } from "zod";
import { SyncStatusSchema } from "./sync-status.schema.ts";
import {
  AccountNumberSchema,
  AccountProviderSchema,
  AccountTypeSchema,
  CurrencySchema,
} from "./truelayer.schema.ts";

export const AccountSchema = z
  .object({
    id: z.uuid(),
    accountId: z.string(),
    accountType: AccountTypeSchema.nullable(),
    displayName: z.string().min(1).max(255),
    currency: CurrencySchema,
    accountNumber: AccountNumberSchema,
    provider: AccountProviderSchema,
    updatedAt: z.iso.datetime(),
    currentBalance: z.string().nullable(),
    availableBalance: z.string().nullable(),
    overdraft: z.string().nullable(),
    balanceUpdatedAt: z.iso.datetime().nullable(),
    syncStatus: SyncStatusSchema,
    lastSyncedAt: z.iso.datetime().nullable(),
  })
  .meta({ id: "Account" });

export type Account = z.infer<typeof AccountSchema>;

export const CreateAccountSchema = AccountSchema.omit({
  id: true,
  updatedAt: true,
  currentBalance: true,
  availableBalance: true,
  overdraft: true,
  balanceUpdatedAt: true,
  syncStatus: true,
  lastSyncedAt: true,
}).meta({ id: "CreateAccount" });

export type CreateAccount = z.infer<typeof CreateAccountSchema>;

export const UpdateAccountInputSchema = CreateAccountSchema.pick({
  displayName: true,
})
  .partial()
  .extend({ id: z.uuid() })
  .meta({ id: "UpdateAccountInput" });

export type UpdateAccountInput = z.infer<typeof UpdateAccountInputSchema>;

export const UpdateAccountResponseSchema = z
  .object({
    account: AccountSchema,
  })
  .meta({ id: "UpdateAccountResponse" });

export type UpdateAccountResponse = z.infer<typeof UpdateAccountResponseSchema>;

export const GetAccountsResponseSchema = z
  .object({
    accounts: z.array(AccountSchema),
  })
  .meta({ id: "GetAccountsResponse" });

export type GetAccountsResponse = z.infer<typeof GetAccountsResponseSchema>;

export const DeleteAccountInputSchema = AccountSchema.pick({
  id: true,
}).meta({ id: "DeleteAccountInput" });

export type DeleteAccountInput = z.infer<typeof DeleteAccountInputSchema>;

export const DeleteAccountResponseSchema = z
  .object({
    success: z.boolean(),
  })
  .meta({ id: "DeleteAccountResponse" });

export type DeleteAccountResponse = z.infer<typeof DeleteAccountResponseSchema>;
