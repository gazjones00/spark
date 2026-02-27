import { oc } from "@orpc/contract";

import { healthRoute } from "./contracts/health.ts";
import { truelayerRouter } from "./contracts/truelayer.ts";
import { accountsRouter } from "./contracts/accounts.ts";
import { settingsRouter } from "./contracts/settings.ts";
import { transactionsRouter } from "./contracts/transactions.ts";

export const contract = oc.router({
  health: healthRoute,
  truelayer: truelayerRouter,
  accounts: accountsRouter,
  settings: settingsRouter,
  transactions: transactionsRouter,
});

export type Contract = typeof contract;

// Re-export all schemas and types from domain contracts
export { HelloResponseSchema } from "./contracts/health.ts";

export {
  AuthLinkResponseSchema,
  GenerateAuthLinkInputSchema,
  ExchangeCodeInputSchema,
  ExchangeCodeResponseSchema,
  SaveAccountsInputSchema,
  SaveAccountsResponseSchema,
} from "./contracts/truelayer.ts";

export {
  SavedAccountSchema,
  GetAccountsResponseSchema,
  UpdateAccountInputSchema,
  UpdateAccountResponseSchema,
  DeleteAccountInputSchema,
  DeleteAccountResponseSchema,
} from "./contracts/accounts.ts";

export type { Account } from "./contracts/accounts.ts";

export {
  SavedTransactionSchema,
  ListTransactionsInputSchema,
  ListTransactionsResponseSchema,
} from "./contracts/transactions.ts";

export type {
  SavedTransaction,
  ListTransactionsInput,
  ListTransactionsResponse,
} from "./contracts/transactions.ts";

export {
  ChangePasswordInputSchema,
  ChangePasswordResponseSchema,
  NotificationPreferencesSchema,
  UpdateNotificationPreferencesInputSchema,
  ThemeSchema,
  UserPreferencesSchema,
  UpdateUserPreferencesInputSchema,
} from "./contracts/settings.ts";

export {
  AccountNumberSchema,
  AccountProviderSchema,
  AccountSchema,
  AccountTypeSchema,
  CurrencySchema,
} from "@spark/truelayer/schemas";
