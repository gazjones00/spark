import { oc } from "@orpc/contract";

import { accountsRouter } from "./contracts/accounts.ts";
import { connectorsRouter } from "./contracts/connectors.ts";
import { healthRoute } from "./contracts/health.ts";
import { settingsRouter } from "./contracts/settings.ts";
import { transactionsRouter } from "./contracts/transactions.ts";
import { truelayerRouter } from "./contracts/truelayer.ts";

export const contract = oc.router({
  health: healthRoute,
  truelayer: truelayerRouter,
  accounts: accountsRouter,
  connectors: connectorsRouter,
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

export {
  ConnectorManifestSchema,
  CreateConnectorConnectionInputSchema,
  CreateConnectorConnectionResponseSchema,
  DeleteConnectorConnectionInputSchema,
  DeleteConnectorConnectionResponseSchema,
  ListConnectorConnectionsResponseSchema,
  ListConnectorsResponseSchema,
  SyncConnectorConnectionInputSchema,
  SyncConnectorConnectionResponseSchema,
  TestConnectorConnectionInputSchema,
  TestConnectorConnectionResponseSchema,
} from "@spark/connectors";

export type {
  Account,
  ListTransactionsInput,
  ListTransactionsResponse,
  SavedTransaction,
  TrueLayerAccount,
} from "@spark/schema";

export type {
  ConnectorManifest,
  CreateConnectorConnectionInput,
  CreateConnectorConnectionResponse,
  DeleteConnectorConnectionInput,
  DeleteConnectorConnectionResponse,
  ListConnectorConnectionsResponse,
  ListConnectorsResponse,
  SyncConnectorConnectionInput,
  SyncConnectorConnectionResponse,
  TestConnectorConnectionInput,
  TestConnectorConnectionResponse,
} from "@spark/connectors";
