import { z } from "zod";

/**
 * Canonical account classification shared across the domain: connectors fold
 * provider-specific account types into these values, and consumers (net
 * worth, aggregation) branch on them rather than on raw provider types.
 */
export const FinancialAccountType = {
  Invest: "INVEST",
  StocksIsa: "STOCKS_ISA",
  Cash: "CASH",
  Savings: "SAVINGS",
  Card: "CARD",
  Pension: "PENSION",
  Crypto: "CRYPTO",
  Unknown: "UNKNOWN",
} as const;

export const FinancialAccountTypeSchema = z.enum([
  FinancialAccountType.Invest,
  FinancialAccountType.StocksIsa,
  FinancialAccountType.Cash,
  FinancialAccountType.Savings,
  FinancialAccountType.Card,
  FinancialAccountType.Pension,
  FinancialAccountType.Crypto,
  FinancialAccountType.Unknown,
]);

export type FinancialAccountType = z.infer<typeof FinancialAccountTypeSchema>;
