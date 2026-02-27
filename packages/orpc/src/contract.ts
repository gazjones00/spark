import { oc } from "@orpc/contract";

import { accountsRouter } from "./contracts/accounts.ts";
import { healthRoute } from "./contracts/health.ts";
import { settingsRouter } from "./contracts/settings.ts";
import { transactionsRouter } from "./contracts/transactions.ts";
import { truelayerRouter } from "./contracts/truelayer.ts";

export const contract = oc.router({
  health: healthRoute,
  truelayer: truelayerRouter,
  accounts: accountsRouter,
  settings: settingsRouter,
  transactions: transactionsRouter,
});

export type Contract = typeof contract;

export {
  AccountNumberSchema,
  AccountProviderSchema,
  AccountSchema,
  AccountTypeSchema,
  AuthLinkResponseSchema,
  ChangePasswordInputSchema,
  ChangePasswordResponseSchema,
  CurrencySchema,
  DeleteAccountInputSchema,
  DeleteAccountResponseSchema,
  ExchangeCodeInputSchema,
  ExchangeCodeResponseSchema,
  GenerateAuthLinkInputSchema,
  GetAccountsResponseSchema,
  HelloResponseSchema,
  ListTransactionsInputSchema,
  ListTransactionsResponseSchema,
  NotificationPreferencesSchema,
  SaveAccountsInputSchema,
  SaveAccountsResponseSchema,
  SavedTransactionSchema,
  ThemeSchema,
  TrueLayerAccountSchema,
  UpdateAccountInputSchema,
  UpdateAccountResponseSchema,
  UpdateNotificationPreferencesInputSchema,
  UpdateUserPreferencesInputSchema,
  UserPreferencesSchema,
} from "@spark/schema";

export type {
  Account,
  ListTransactionsInput,
  ListTransactionsResponse,
  SavedTransaction,
  TrueLayerAccount,
} from "@spark/schema";
