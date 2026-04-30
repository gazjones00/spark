import { z } from "zod";

export const FinancialProviderType = {
  Broker: "BROKER",
  Bank: "BANK",
  Pension: "PENSION",
  Crypto: "CRYPTO",
  Manual: "MANUAL",
} as const;

export const FinancialAccountType = {
  Invest: "INVEST",
  StocksIsa: "STOCKS_ISA",
  Cash: "CASH",
  Savings: "SAVINGS",
  Pension: "PENSION",
  Crypto: "CRYPTO",
  Unknown: "UNKNOWN",
} as const;

export const FinancialTransactionType = {
  Deposit: "DEPOSIT",
  Withdrawal: "WITHDRAWAL",
  Buy: "BUY",
  Sell: "SELL",
  Dividend: "DIVIDEND",
  Interest: "INTEREST",
  Fee: "FEE",
  Tax: "TAX",
  TransferIn: "TRANSFER_IN",
  TransferOut: "TRANSFER_OUT",
  FxConversion: "FX_CONVERSION",
  CorporateAction: "CORPORATE_ACTION",
  CashAdjustment: "CASH_ADJUSTMENT",
  Other: "OTHER",
} as const;

export const FinancialTransactionStatus = {
  Pending: "PENDING",
  Settled: "SETTLED",
  Cancelled: "CANCELLED",
  Rejected: "REJECTED",
  Unknown: "UNKNOWN",
} as const;

export const InstrumentType = {
  Stock: "STOCK",
  Etf: "ETF",
  Fund: "FUND",
  Cash: "CASH",
  Crypto: "CRYPTO",
  Bond: "BOND",
  Other: "OTHER",
} as const;

const CurrencyCodeSchema = z.string().trim().length(3).toUpperCase();
const JsonRecordSchema = z.record(z.string(), z.unknown());

export const FinancialProviderTypeSchema = z.enum([
  FinancialProviderType.Broker,
  FinancialProviderType.Bank,
  FinancialProviderType.Pension,
  FinancialProviderType.Crypto,
  FinancialProviderType.Manual,
]);

export const FinancialAccountTypeSchema = z.enum([
  FinancialAccountType.Invest,
  FinancialAccountType.StocksIsa,
  FinancialAccountType.Cash,
  FinancialAccountType.Savings,
  FinancialAccountType.Pension,
  FinancialAccountType.Crypto,
  FinancialAccountType.Unknown,
]);

export const FinancialTransactionTypeSchema = z.enum([
  FinancialTransactionType.Deposit,
  FinancialTransactionType.Withdrawal,
  FinancialTransactionType.Buy,
  FinancialTransactionType.Sell,
  FinancialTransactionType.Dividend,
  FinancialTransactionType.Interest,
  FinancialTransactionType.Fee,
  FinancialTransactionType.Tax,
  FinancialTransactionType.TransferIn,
  FinancialTransactionType.TransferOut,
  FinancialTransactionType.FxConversion,
  FinancialTransactionType.CorporateAction,
  FinancialTransactionType.CashAdjustment,
  FinancialTransactionType.Other,
]);

export const FinancialTransactionStatusSchema = z.enum([
  FinancialTransactionStatus.Pending,
  FinancialTransactionStatus.Settled,
  FinancialTransactionStatus.Cancelled,
  FinancialTransactionStatus.Rejected,
  FinancialTransactionStatus.Unknown,
]);

export const InstrumentTypeSchema = z.enum([
  InstrumentType.Stock,
  InstrumentType.Etf,
  InstrumentType.Fund,
  InstrumentType.Cash,
  InstrumentType.Crypto,
  InstrumentType.Bond,
  InstrumentType.Other,
]);

export const FinancialAccountSchema = z.object({
  externalId: z.string().min(1),
  providerId: z.string().min(1),
  providerName: z.string().min(1),
  type: FinancialAccountTypeSchema,
  displayName: z.string().min(1),
  currency: CurrencyCodeSchema,
  metadata: JsonRecordSchema.default({}),
});

export const InstrumentSchema = z.object({
  externalId: z.string().min(1),
  providerId: z.string().min(1),
  ticker: z.string().min(1),
  name: z.string().nullable(),
  isin: z.string().nullable(),
  currency: CurrencyCodeSchema.nullable(),
  type: InstrumentTypeSchema,
  metadata: JsonRecordSchema.default({}),
});

export const FinancialTransactionSchema = z.object({
  externalId: z.string().min(1),
  accountExternalId: z.string().min(1),
  providerId: z.string().min(1),
  type: FinancialTransactionTypeSchema,
  status: FinancialTransactionStatusSchema,
  occurredAt: z.iso.datetime(),
  settledAt: z.iso.datetime().nullable(),
  description: z.string().min(1),
  amount: z.number(),
  currency: CurrencyCodeSchema,
  instrumentExternalId: z.string().nullable(),
  quantity: z.number().nullable(),
  price: z.number().nullable(),
  fees: z.number().nullable(),
  tax: z.number().nullable(),
  fxRate: z.number().nullable(),
  metadata: JsonRecordSchema.default({}),
});

export const HoldingSchema = z.object({
  externalId: z.string().min(1),
  accountExternalId: z.string().min(1),
  providerId: z.string().min(1),
  instrumentExternalId: z.string().min(1),
  quantity: z.number(),
  availableQuantity: z.number().nullable(),
  averagePrice: z.number().nullable(),
  currentPrice: z.number().nullable(),
  currency: CurrencyCodeSchema,
  value: z.number().nullable(),
  costBasis: z.number().nullable(),
  unrealizedProfitLoss: z.number().nullable(),
  observedAt: z.iso.datetime(),
  metadata: JsonRecordSchema.default({}),
});

export const BalanceSnapshotSchema = z.object({
  accountExternalId: z.string().min(1),
  providerId: z.string().min(1),
  currency: CurrencyCodeSchema,
  cash: z.number(),
  availableCash: z.number().nullable(),
  blockedCash: z.number().nullable(),
  invested: z.number().nullable(),
  total: z.number(),
  observedAt: z.iso.datetime(),
  metadata: JsonRecordSchema.default({}),
});

export const PortfolioSnapshotSchema = z.object({
  accountExternalId: z.string().min(1),
  providerId: z.string().min(1),
  currency: CurrencyCodeSchema,
  cashValue: z.number(),
  investmentValue: z.number(),
  totalValue: z.number(),
  costBasis: z.number().nullable(),
  realizedProfitLoss: z.number().nullable(),
  unrealizedProfitLoss: z.number().nullable(),
  observedAt: z.iso.datetime(),
  metadata: JsonRecordSchema.default({}),
});

export type FinancialProviderType = z.infer<typeof FinancialProviderTypeSchema>;
export type FinancialAccountType = z.infer<typeof FinancialAccountTypeSchema>;
export type FinancialTransactionType = z.infer<typeof FinancialTransactionTypeSchema>;
export type FinancialTransactionStatus = z.infer<typeof FinancialTransactionStatusSchema>;
export type InstrumentType = z.infer<typeof InstrumentTypeSchema>;
export type FinancialAccount = z.infer<typeof FinancialAccountSchema>;
export type Instrument = z.infer<typeof InstrumentSchema>;
export type FinancialTransaction = z.infer<typeof FinancialTransactionSchema>;
export type Holding = z.infer<typeof HoldingSchema>;
export type BalanceSnapshot = z.infer<typeof BalanceSnapshotSchema>;
export type PortfolioSnapshot = z.infer<typeof PortfolioSnapshotSchema>;
