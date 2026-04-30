import {
  ConnectorCapability,
  ConnectorAuthType,
  FinancialAccountType,
  FinancialProviderType,
} from "../core/index.ts";
import type { ConnectorManifest } from "../core/index.ts";

export const TRADING212_PROVIDER_ID = "trading212";
export const TRADING212_DISPLAY_NAME = "Trading 212";

export const TRADING212_ENVIRONMENTS = {
  demo: "https://demo.trading212.com/api/v0",
  live: "https://live.trading212.com/api/v0",
} as const;

export type Trading212Environment = keyof typeof TRADING212_ENVIRONMENTS;

export const TRADING212_MANIFEST: ConnectorManifest = {
  id: TRADING212_PROVIDER_ID,
  displayName: TRADING212_DISPLAY_NAME,
  providerType: FinancialProviderType.Broker,
  version: "0.1.0",
  readOnly: true,
  auth: {
    type: ConnectorAuthType.BasicApiKey,
    fields: [
      {
        key: "apiKey",
        label: "API Key",
        type: "password",
        required: true,
        secret: true,
      },
      {
        key: "apiSecret",
        label: "API Secret",
        type: "password",
        required: true,
        secret: true,
      },
    ],
  },
  environments: [
    {
      key: "demo",
      label: "Paper Trading",
      baseUrl: TRADING212_ENVIRONMENTS.demo,
      default: false,
    },
    {
      key: "live",
      label: "Live",
      baseUrl: TRADING212_ENVIRONMENTS.live,
      default: true,
    },
  ],
  connectionOptions: [
    {
      key: "accountType",
      label: "Account type",
      type: "select",
      required: false,
      defaultValue: FinancialAccountType.Invest,
      options: [
        { value: FinancialAccountType.Invest, label: "Invest" },
        { value: FinancialAccountType.StocksIsa, label: "Stocks ISA" },
      ],
    },
  ],
  capabilities: [
    ConnectorCapability.ConnectionTest,
    ConnectorCapability.AccountsList,
    ConnectorCapability.BalancesSync,
    ConnectorCapability.TransactionsSync,
    ConnectorCapability.HoldingsSync,
    ConnectorCapability.PortfolioSync,
    ConnectorCapability.InstrumentsSync,
    ConnectorCapability.DividendsSync,
  ],
  resources: [
    {
      key: "account-summary",
      label: "Account summary",
      path: "/equity/account/summary",
      paginated: false,
      syncMode: "SNAPSHOT",
    },
    {
      key: "positions",
      label: "Open positions",
      path: "/equity/positions",
      paginated: false,
      syncMode: "SNAPSHOT",
    },
    {
      key: "instruments",
      label: "Instruments",
      path: "/equity/metadata/instruments",
      paginated: false,
      syncMode: "FULL_REFRESH",
    },
    {
      key: "history-orders",
      label: "Historical orders",
      path: "/equity/history/orders",
      paginated: true,
      syncMode: "INCREMENTAL",
    },
    {
      key: "history-dividends",
      label: "Dividends",
      path: "/equity/history/dividends",
      paginated: true,
      syncMode: "INCREMENTAL",
    },
    {
      key: "history-transactions",
      label: "Cash transactions",
      path: "/equity/history/transactions",
      paginated: true,
      syncMode: "INCREMENTAL",
    },
  ],
  knownLimitations: [
    "Trading 212 Public API is beta and currently limited to Invest and Stocks ISA accounts.",
    "Spark uses the Trading 212 connector in read-only mode and does not place or cancel orders.",
  ],
  metadata: {
    docsUrl: "https://docs.trading212.com/",
  },
};
