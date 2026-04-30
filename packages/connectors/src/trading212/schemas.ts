import { z } from "zod";

const CurrencyCodeSchema = z.string().trim().length(3).toUpperCase();
const ProviderDateTimeSchema = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Invalid date-time",
  });

export const Trading212AccountSummarySchema = z
  .object({
    id: z.number(),
    currency: CurrencyCodeSchema,
    cash: z.object({
      availableToTrade: z.number(),
      inPies: z.number(),
      reservedForOrders: z.number(),
    }),
    investments: z.object({
      currentValue: z.number(),
      realizedProfitLoss: z.number(),
      totalCost: z.number(),
      unrealizedProfitLoss: z.number(),
    }),
    totalValue: z.number(),
  })
  .catchall(z.unknown());

export const Trading212InstrumentSchema = z
  .object({
    ticker: z.string().min(1),
    name: z.string().nullish(),
    isin: z.string().nullish(),
    currency: CurrencyCodeSchema.nullish(),
    currencyCode: CurrencyCodeSchema.nullish(),
    type: z.string().nullish(),
    shortName: z.string().nullish(),
    addedOn: ProviderDateTimeSchema.nullish(),
    extendedHours: z.boolean().nullish(),
    maxOpenQuantity: z.number().nullish(),
    workingScheduleId: z.number().nullish(),
  })
  .catchall(z.unknown());

export const Trading212TaxSchema = z
  .object({
    chargedAt: ProviderDateTimeSchema.nullish(),
    currency: CurrencyCodeSchema.nullish(),
    name: z.string().nullish(),
    quantity: z.number(),
  })
  .catchall(z.unknown());

export const Trading212FillWalletImpactSchema = z
  .object({
    currency: CurrencyCodeSchema.nullish(),
    fxRate: z.number().nullish(),
    netValue: z.number().nullish(),
    realisedProfitLoss: z.number().nullish(),
    taxes: z.array(Trading212TaxSchema).nullish(),
  })
  .catchall(z.unknown());

export const Trading212PositionWalletImpactSchema = z
  .object({
    currency: CurrencyCodeSchema.nullish(),
    currentValue: z.number().nullish(),
    fxImpact: z.number().nullish(),
    totalCost: z.number().nullish(),
    unrealizedProfitLoss: z.number().nullish(),
  })
  .catchall(z.unknown());

export const Trading212PositionSchema = z
  .object({
    averagePricePaid: z.number(),
    createdAt: ProviderDateTimeSchema,
    currentPrice: z.number(),
    instrument: Trading212InstrumentSchema,
    quantity: z.number(),
    quantityAvailableForTrading: z.number().nullish(),
    quantityInPies: z.number().nullish(),
    walletImpact: Trading212PositionWalletImpactSchema.nullish(),
  })
  .catchall(z.unknown());

export const Trading212OrderDetailsSchema = z
  .object({
    id: z.number(),
    createdAt: ProviderDateTimeSchema.nullish(),
    currency: CurrencyCodeSchema.nullish(),
    extendedHours: z.boolean().nullish(),
    filledQuantity: z.number().nullish(),
    filledValue: z.number().nullish(),
    initiatedFrom: z.string().nullish(),
    instrument: Trading212InstrumentSchema.optional(),
    limitPrice: z.number().nullish(),
    quantity: z.number().nullish(),
    side: z.enum(["BUY", "SELL"]).nullish(),
    status: z.string().nullish(),
    stopPrice: z.number().nullish(),
    strategy: z.string().nullish(),
    ticker: z.string().min(1),
    timeInForce: z.string().nullish(),
    type: z.string().nullish(),
    value: z.number().nullish(),
  })
  .catchall(z.unknown());

export const Trading212FillSchema = z
  .object({
    filledAt: ProviderDateTimeSchema.nullish(),
    id: z.number().nullish(),
    price: z.number().nullish(),
    quantity: z.number().nullish(),
    tradingMethod: z.string().nullish(),
    type: z.string().nullish(),
    walletImpact: Trading212FillWalletImpactSchema.nullish(),
  })
  .catchall(z.unknown());

export const Trading212HistoricalOrderSchema = z
  .object({
    order: Trading212OrderDetailsSchema,
    fill: Trading212FillSchema.nullish(),
  })
  .catchall(z.unknown());

export const Trading212DividendSchema = z
  .object({
    amount: z.number(),
    amountInEuro: z.number().nullish(),
    currency: CurrencyCodeSchema.nullish(),
    grossAmountPerShare: z.number().nullish(),
    paidOn: ProviderDateTimeSchema.nullish(),
    ticker: z.string().min(1),
    tickerCurrency: CurrencyCodeSchema.nullish(),
    type: z.string().nullish(),
    reference: z.string().nullish(),
    quantity: z.number().nullish(),
    instrument: Trading212InstrumentSchema.optional(),
  })
  .catchall(z.unknown());

export const Trading212HistoryTransactionSchema = z
  .object({
    amount: z.number(),
    currency: CurrencyCodeSchema.nullish(),
    dateTime: ProviderDateTimeSchema.nullish(),
    reference: z.string().nullish(),
    type: z.string().nullish(),
  })
  .catchall(z.unknown());

export const Trading212PaginatedOrdersSchema = z
  .object({
    items: z.array(Trading212HistoricalOrderSchema),
    nextPagePath: z.string().nullable(),
  })
  .catchall(z.unknown());

export const Trading212PaginatedDividendsSchema = z
  .object({
    items: z.array(Trading212DividendSchema),
    nextPagePath: z.string().nullable(),
  })
  .catchall(z.unknown());

export const Trading212PaginatedTransactionsSchema = z
  .object({
    items: z.array(Trading212HistoryTransactionSchema),
    nextPagePath: z.string().nullable(),
  })
  .catchall(z.unknown());

export type Trading212AccountSummary = z.infer<typeof Trading212AccountSummarySchema>;
export type Trading212Instrument = z.infer<typeof Trading212InstrumentSchema>;
export type Trading212Tax = z.infer<typeof Trading212TaxSchema>;
export type Trading212FillWalletImpact = z.infer<typeof Trading212FillWalletImpactSchema>;
export type Trading212PositionWalletImpact = z.infer<typeof Trading212PositionWalletImpactSchema>;
export type Trading212Position = z.infer<typeof Trading212PositionSchema>;
export type Trading212OrderDetails = z.infer<typeof Trading212OrderDetailsSchema>;
export type Trading212Fill = z.infer<typeof Trading212FillSchema>;
export type Trading212HistoricalOrder = z.infer<typeof Trading212HistoricalOrderSchema>;
export type Trading212Dividend = z.infer<typeof Trading212DividendSchema>;
export type Trading212HistoryTransaction = z.infer<typeof Trading212HistoryTransactionSchema>;
export type Trading212PaginatedOrders = z.infer<typeof Trading212PaginatedOrdersSchema>;
export type Trading212PaginatedDividends = z.infer<typeof Trading212PaginatedDividendsSchema>;
export type Trading212PaginatedTransactions = z.infer<typeof Trading212PaginatedTransactionsSchema>;
