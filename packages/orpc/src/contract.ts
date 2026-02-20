import { oc } from "@orpc/contract";

import { healthRoute } from "./contracts/health";
import { truelayerRouter } from "./contracts/truelayer";
import { accountsRouter } from "./contracts/accounts";
import { settingsRouter } from "./contracts/settings";
import { transactionsRouter } from "./contracts/transactions";

export const contract = oc.router({
  health: healthRoute,
  truelayer: truelayerRouter,
  accounts: accountsRouter,
  settings: settingsRouter,
  transactions: transactionsRouter,
});

export type Contract = typeof contract;

// Re-export all schemas and types from domain contracts
export { HelloResponseSchema } from "./contracts/health";

export {
  AuthLinkResponseSchema,
  GenerateAuthLinkInputSchema,
  ExchangeCodeInputSchema,
  ExchangeCodeResponseSchema,
  SaveAccountsInputSchema,
  SaveAccountsResponseSchema,
} from "./contracts/truelayer";

export {
  SavedAccountSchema,
  GetAccountsResponseSchema,
  UpdateAccountInputSchema,
  UpdateAccountResponseSchema,
  DeleteAccountInputSchema,
  DeleteAccountResponseSchema,
  SyncStatusSchema,
} from "./contracts/accounts";

export type { Account, SyncStatus } from "./contracts/accounts";

export { SavedTransactionSchema, GetTransactionsResponseSchema } from "./contracts/transactions";

export type { SavedTransaction } from "./contracts/transactions";

export {
  ChangePasswordInputSchema,
  ChangePasswordResponseSchema,
  NotificationPreferencesSchema,
  UpdateNotificationPreferencesInputSchema,
  ThemeSchema,
  UserPreferencesSchema,
  UpdateUserPreferencesInputSchema,
} from "./contracts/settings";

export {
  AccountNumberSchema,
  AccountProviderSchema,
  AccountSchema,
  AccountTypeSchema,
  CurrencySchema,
} from "@spark/truelayer/schemas";
