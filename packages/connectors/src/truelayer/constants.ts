import { ConnectorAuthType, ConnectorCapability, FinancialProviderType } from "../core/index.ts";
import type { ConnectorManifest } from "../core/index.ts";

export const TRUELAYER_PROVIDER_ID = "truelayer";
export const TRUELAYER_DISPLAY_NAME = "TrueLayer";

export const TRUELAYER_ENVIRONMENTS = {
  sandbox: "https://api.truelayer-sandbox.com",
  production: "https://api.truelayer.com",
} as const;

export type TrueLayerConnectorEnvironment = keyof typeof TRUELAYER_ENVIRONMENTS;

export const TRUELAYER_MANIFEST: ConnectorManifest = {
  id: TRUELAYER_PROVIDER_ID,
  displayName: TRUELAYER_DISPLAY_NAME,
  providerType: FinancialProviderType.Bank,
  version: "0.1.0",
  readOnly: true,
  auth: {
    type: ConnectorAuthType.OAuth2,
    // No user-entered fields: the user authorises via the TrueLayer redirect
    // flow and the server stores the resulting token record as the encrypted
    // credential blob ({ accessToken, refreshToken, expiresAt }).
    fields: [],
  },
  environments: [
    {
      key: "sandbox",
      label: "Sandbox",
      baseUrl: TRUELAYER_ENVIRONMENTS.sandbox,
      default: false,
    },
    {
      key: "production",
      label: "Production",
      baseUrl: TRUELAYER_ENVIRONMENTS.production,
      default: true,
    },
  ],
  connectionOptions: [],
  capabilities: [
    ConnectorCapability.ConnectionTest,
    ConnectorCapability.AccountsList,
    ConnectorCapability.BalancesSync,
    ConnectorCapability.TransactionsSync,
  ],
  resources: [
    {
      key: "accounts",
      label: "Accounts",
      path: "/data/v1/accounts",
      paginated: false,
      syncMode: "SNAPSHOT",
    },
    {
      key: "balance",
      label: "Balances",
      path: "/data/v1/accounts/{accountId}/balance",
      paginated: false,
      syncMode: "SNAPSHOT",
    },
    {
      key: "transactions",
      label: "Transactions",
      path: "/data/v1/accounts/{accountId}/transactions",
      paginated: false,
      syncMode: "INCREMENTAL",
    },
  ],
  knownLimitations: [
    "Credentials are not collected via auth fields: the user authorises through the TrueLayer OAuth redirect flow and the connection is created server-side with the exchanged token record.",
    "The connection metadata may carry an accountIds allow-list (the accounts the user selected during connect); accounts outside it are not synced.",
    "TrueLayer transactions are settled bank transactions; card and charge-card accounts map to the CASH account type with the raw type preserved in metadata.",
  ],
  metadata: {
    docsUrl: "https://docs.truelayer.com/",
  },
};
