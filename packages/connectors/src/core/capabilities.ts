import { z } from "zod";

export const ConnectorCapability = {
  ConnectionTest: "connection:test",
  AccountsList: "accounts:list",
  BalancesSync: "balances:sync",
  TransactionsSync: "transactions:sync",
  HoldingsSync: "holdings:sync",
  PortfolioSync: "portfolio:sync",
  InstrumentsSync: "instruments:sync",
  DividendsSync: "dividends:sync",
} as const;

export const ConnectorCapabilitySchema = z.enum([
  ConnectorCapability.ConnectionTest,
  ConnectorCapability.AccountsList,
  ConnectorCapability.BalancesSync,
  ConnectorCapability.TransactionsSync,
  ConnectorCapability.HoldingsSync,
  ConnectorCapability.PortfolioSync,
  ConnectorCapability.InstrumentsSync,
  ConnectorCapability.DividendsSync,
]);

export type ConnectorCapability = z.infer<typeof ConnectorCapabilitySchema>;

export const ConnectorCapabilitiesSchema = z.array(ConnectorCapabilitySchema).readonly();

export type ConnectorCapabilities = readonly ConnectorCapability[];
