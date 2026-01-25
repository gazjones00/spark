import { oc } from "@orpc/contract";
import {
  AccountNumberSchema,
  AccountProviderSchema,
  AccountTypeSchema,
  CurrencySchema,
} from "@spark/truelayer/schemas";
import { z } from "zod";

export const SyncStatusSchema = z.enum(["OK", "NEEDS_REAUTH", "ERROR"]);
export type SyncStatus = z.infer<typeof SyncStatusSchema>;

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
  syncStatus: SyncStatusSchema,
  lastSyncedAt: z.string().nullable(),
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

export type Account = z.infer<typeof SavedAccountSchema>;

export const accountsRouter = oc.router({
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
});
