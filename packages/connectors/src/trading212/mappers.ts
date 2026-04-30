import {
  BalanceSnapshotSchema,
  FinancialAccountSchema,
  FinancialAccountType,
  FinancialTransactionSchema,
  FinancialTransactionStatus,
  FinancialTransactionType,
  HoldingSchema,
  InstrumentSchema,
  InstrumentType,
  PortfolioSnapshotSchema,
  type BalanceSnapshot,
  type FinancialAccount,
  type FinancialTransaction,
  type Holding,
  type Instrument,
  type PortfolioSnapshot,
  type RawProviderRecord,
} from "../core/index.ts";
import { TRADING212_DISPLAY_NAME, TRADING212_PROVIDER_ID } from "./constants.ts";
import type {
  Trading212AccountSummary,
  Trading212Dividend,
  Trading212HistoricalOrder,
  Trading212HistoryTransaction,
  Trading212Instrument,
  Trading212Position,
  Trading212Tax,
} from "./schemas.ts";

export function trading212AccountExternalId(accountSummary: Trading212AccountSummary): string {
  return `${TRADING212_PROVIDER_ID}:account:${accountSummary.id}`;
}

export function trading212InstrumentExternalId(ticker: string): string {
  return `${TRADING212_PROVIDER_ID}:instrument:${ticker}`;
}

export function mapTrading212Account(accountSummary: Trading212AccountSummary): FinancialAccount {
  return mapTrading212AccountWithType(accountSummary, FinancialAccountType.Invest);
}

export function mapTrading212AccountWithType(
  accountSummary: Trading212AccountSummary,
  accountType: FinancialAccountType,
): FinancialAccount {
  return FinancialAccountSchema.parse({
    externalId: trading212AccountExternalId(accountSummary),
    providerId: TRADING212_PROVIDER_ID,
    providerName: TRADING212_DISPLAY_NAME,
    type: accountType,
    displayName: `${TRADING212_DISPLAY_NAME} ${accountSummary.id}`,
    currency: accountSummary.currency,
    metadata: {
      providerAccountId: accountSummary.id,
    },
  });
}

export function mapTrading212BalanceSnapshot(
  accountSummary: Trading212AccountSummary,
  observedAt: string,
): BalanceSnapshot {
  const cash = accountSummary.cash.availableToTrade + accountSummary.cash.reservedForOrders;
  return BalanceSnapshotSchema.parse({
    accountExternalId: trading212AccountExternalId(accountSummary),
    providerId: TRADING212_PROVIDER_ID,
    currency: accountSummary.currency,
    cash: cash + accountSummary.cash.inPies,
    availableCash: accountSummary.cash.availableToTrade,
    blockedCash: accountSummary.cash.reservedForOrders,
    invested: accountSummary.investments.currentValue,
    total: accountSummary.totalValue,
    observedAt,
    metadata: {
      inPies: accountSummary.cash.inPies,
      costBasis: accountSummary.investments.totalCost,
      unrealizedProfitLoss: accountSummary.investments.unrealizedProfitLoss,
      realizedProfitLoss: accountSummary.investments.realizedProfitLoss,
    },
  });
}

export function mapTrading212PortfolioSnapshot(
  accountSummary: Trading212AccountSummary,
  observedAt: string,
): PortfolioSnapshot {
  const cashValue =
    accountSummary.cash.availableToTrade +
    accountSummary.cash.reservedForOrders +
    accountSummary.cash.inPies;
  return PortfolioSnapshotSchema.parse({
    accountExternalId: trading212AccountExternalId(accountSummary),
    providerId: TRADING212_PROVIDER_ID,
    currency: accountSummary.currency,
    cashValue,
    investmentValue: accountSummary.investments.currentValue,
    totalValue: accountSummary.totalValue,
    costBasis: accountSummary.investments.totalCost,
    realizedProfitLoss: accountSummary.investments.realizedProfitLoss,
    unrealizedProfitLoss: accountSummary.investments.unrealizedProfitLoss,
    observedAt,
    metadata: {},
  });
}

export function mapTrading212Instrument(instrument: Trading212Instrument): Instrument {
  return InstrumentSchema.parse({
    externalId: trading212InstrumentExternalId(instrument.ticker),
    providerId: TRADING212_PROVIDER_ID,
    ticker: instrument.ticker,
    name: instrument.name ?? instrument.shortName ?? null,
    isin: instrument.isin ?? null,
    currency: instrument.currency ?? instrument.currencyCode ?? null,
    type: classifyInstrumentType(instrument),
    metadata: {
      providerType: instrument.type ?? null,
      addedOn: instrument.addedOn ?? null,
      extendedHours: instrument.extendedHours ?? null,
      maxOpenQuantity: instrument.maxOpenQuantity ?? null,
      workingScheduleId: instrument.workingScheduleId ?? null,
    },
  });
}

export function mapTrading212Holding(
  accountSummary: Trading212AccountSummary,
  position: Trading212Position,
  observedAt: string,
): Holding {
  const value = position.walletImpact?.currentValue ?? position.quantity * position.currentPrice;
  const costBasis =
    position.walletImpact?.totalCost ?? position.quantity * position.averagePricePaid;
  return HoldingSchema.parse({
    externalId: `${trading212AccountExternalId(accountSummary)}:holding:${position.instrument.ticker}`,
    accountExternalId: trading212AccountExternalId(accountSummary),
    providerId: TRADING212_PROVIDER_ID,
    instrumentExternalId: trading212InstrumentExternalId(position.instrument.ticker),
    quantity: position.quantity,
    availableQuantity: position.quantityAvailableForTrading ?? null,
    averagePrice: position.averagePricePaid,
    currentPrice: position.currentPrice,
    currency:
      position.walletImpact?.currency ?? position.instrument.currency ?? accountSummary.currency,
    value,
    costBasis,
    unrealizedProfitLoss: position.walletImpact?.unrealizedProfitLoss ?? value - costBasis,
    observedAt,
    metadata: {
      createdAt: position.createdAt,
      quantityInPies: position.quantityInPies ?? null,
      walletImpact: position.walletImpact ?? null,
    },
  });
}

export function mapTrading212OrderTransaction(
  accountSummary: Trading212AccountSummary,
  historicalOrder: Trading212HistoricalOrder,
): FinancialTransaction {
  const { order, fill } = historicalOrder;
  const ticker = order.instrument?.ticker ?? order.ticker;
  const side = order.side ?? ((order.quantity ?? 0) < 0 ? "SELL" : "BUY");
  const quantity = Math.abs(fill?.quantity ?? order.filledQuantity ?? order.quantity ?? 0);
  const absoluteAmount = Math.abs(
    fill?.walletImpact?.netValue ??
      order.filledValue ??
      order.value ??
      (quantity && fill?.price ? quantity * fill.price : 0),
  );
  const charges = calculateTrading212Charges(fill?.walletImpact?.taxes ?? []);
  const fillType = fill?.type ?? "TRADE";
  return FinancialTransactionSchema.parse({
    externalId: `${TRADING212_PROVIDER_ID}:order:${order.id}:fill:${fill?.id ?? "order"}`,
    accountExternalId: trading212AccountExternalId(accountSummary),
    providerId: TRADING212_PROVIDER_ID,
    type:
      fillType === "TRADE"
        ? side === "SELL"
          ? FinancialTransactionType.Sell
          : FinancialTransactionType.Buy
        : FinancialTransactionType.CorporateAction,
    status: mapOrderStatus(order.status),
    occurredAt: toIsoDateTime(fill?.filledAt ?? order.createdAt),
    settledAt: nullableIsoDateTime(fill?.filledAt),
    description: `${side} ${ticker}`,
    amount: side === "SELL" ? absoluteAmount : -absoluteAmount,
    currency:
      fill?.walletImpact?.currency ??
      order.currency ??
      order.instrument?.currency ??
      accountSummary.currency,
    instrumentExternalId: trading212InstrumentExternalId(ticker),
    quantity,
    price: fill?.price ?? (quantity > 0 && absoluteAmount > 0 ? absoluteAmount / quantity : null),
    fees: charges.fees,
    tax: charges.tax,
    fxRate: fill?.walletImpact?.fxRate ?? null,
    metadata: {
      orderType: order.type ?? null,
      providerStatus: order.status ?? null,
      fillId: fill?.id ?? null,
      fillType: fill?.type ?? null,
      tradingMethod: fill?.tradingMethod ?? null,
      initiatedFrom: order.initiatedFrom ?? null,
      realisedProfitLoss: fill?.walletImpact?.realisedProfitLoss ?? null,
      taxes: fill?.walletImpact?.taxes ?? [],
    },
  });
}

export function mapTrading212DividendTransaction(
  accountSummary: Trading212AccountSummary,
  dividend: Trading212Dividend,
): FinancialTransaction {
  return FinancialTransactionSchema.parse({
    externalId: `${TRADING212_PROVIDER_ID}:dividend:${stableProviderExternalId([
      dividend.paidOn,
      dividend.ticker,
      dividend.reference,
      dividend.amount,
      dividend.currency,
    ])}`,
    accountExternalId: trading212AccountExternalId(accountSummary),
    providerId: TRADING212_PROVIDER_ID,
    type: FinancialTransactionType.Dividend,
    status: FinancialTransactionStatus.Settled,
    occurredAt: toIsoDateTime(dividend.paidOn),
    settledAt: nullableIsoDateTime(dividend.paidOn),
    description: dividend.reference ?? `Dividend ${dividend.ticker}`,
    amount: dividend.amount,
    currency: dividend.currency ?? accountSummary.currency,
    instrumentExternalId: trading212InstrumentExternalId(dividend.ticker),
    quantity: dividend.quantity ?? null,
    price: dividend.grossAmountPerShare ?? null,
    fees: null,
    tax: null,
    fxRate: null,
    metadata: {
      amountInEuro: dividend.amountInEuro ?? null,
      tickerCurrency: dividend.tickerCurrency ?? null,
      providerType: dividend.type ?? null,
    },
  });
}

export function mapTrading212CashTransaction(
  accountSummary: Trading212AccountSummary,
  transaction: Trading212HistoryTransaction,
): FinancialTransaction {
  const type = classifyCashTransactionType(transaction);
  const amount = normalizeCashTransactionAmount(transaction);
  return FinancialTransactionSchema.parse({
    externalId: `${TRADING212_PROVIDER_ID}:cash-transaction:${
      transaction.reference ??
      stableProviderExternalId([
        transaction.dateTime,
        transaction.type,
        transaction.amount,
        transaction.currency,
      ])
    }`,
    accountExternalId: trading212AccountExternalId(accountSummary),
    providerId: TRADING212_PROVIDER_ID,
    type,
    status: FinancialTransactionStatus.Settled,
    occurredAt: toIsoDateTime(transaction.dateTime),
    settledAt: nullableIsoDateTime(transaction.dateTime),
    description: transaction.reference ?? transaction.type ?? "Trading 212 cash transaction",
    amount,
    currency: transaction.currency ?? accountSummary.currency,
    instrumentExternalId: null,
    quantity: null,
    price: null,
    fees: null,
    tax: null,
    fxRate: null,
    metadata: {
      providerType: transaction.type ?? null,
    },
  });
}

export function createTrading212RawRecord(
  resource: string,
  externalId: string,
  observedAt: string,
  payload: unknown,
): RawProviderRecord {
  return {
    providerId: TRADING212_PROVIDER_ID,
    resource,
    externalId,
    observedAt,
    payload: isRecord(payload) ? payload : { value: payload },
  };
}

function classifyInstrumentType(instrument: Trading212Instrument): InstrumentType {
  const value = `${instrument.type ?? ""} ${instrument.name ?? ""}`.toLowerCase();
  if (value.includes("crypto")) {
    return InstrumentType.Crypto;
  }
  if (value.includes("etf")) {
    return InstrumentType.Etf;
  }
  if (value.includes("fund")) {
    return InstrumentType.Fund;
  }
  return InstrumentType.Stock;
}

function mapOrderStatus(status: string | null | undefined): FinancialTransactionStatus {
  if (status === "FILLED") {
    return FinancialTransactionStatus.Settled;
  }
  if (status === "CANCELLED") {
    return FinancialTransactionStatus.Cancelled;
  }
  if (status === "REJECTED") {
    return FinancialTransactionStatus.Rejected;
  }
  if (status) {
    return FinancialTransactionStatus.Pending;
  }
  return FinancialTransactionStatus.Unknown;
}

function classifyCashTransactionType(
  transaction: Trading212HistoryTransaction,
): FinancialTransactionType {
  const value = `${transaction.type ?? ""} ${transaction.reference ?? ""}`.toLowerCase();
  if (value.includes("deposit")) {
    return FinancialTransactionType.Deposit;
  }
  if (value.includes("withdraw")) {
    return FinancialTransactionType.Withdrawal;
  }
  if (value.includes("interest")) {
    return FinancialTransactionType.Interest;
  }
  if (value.includes("fee")) {
    return FinancialTransactionType.Fee;
  }
  if (value.includes("transfer")) {
    return transaction.amount < 0
      ? FinancialTransactionType.TransferOut
      : FinancialTransactionType.TransferIn;
  }
  if (value.includes("tax")) {
    return FinancialTransactionType.Tax;
  }
  return FinancialTransactionType.CashAdjustment;
}

export function trading212HistoricalOrderCheckpoint(
  order: Trading212HistoricalOrder,
): string | null {
  return nullableIsoDateTime(order.fill?.filledAt ?? order.order.createdAt);
}

export function trading212DividendCheckpoint(dividend: Trading212Dividend): string | null {
  return nullableIsoDateTime(dividend.paidOn);
}

export function trading212CashTransactionCheckpoint(
  transaction: Trading212HistoryTransaction,
): string | null {
  return nullableIsoDateTime(transaction.dateTime);
}

export function trading212HistoricalOrderExternalId(order: Trading212HistoricalOrder): string {
  return `${order.order.id}:${order.fill?.id ?? "order"}`;
}

export function trading212DividendExternalId(dividend: Trading212Dividend): string {
  return stableProviderExternalId([
    dividend.paidOn,
    dividend.ticker,
    dividend.reference,
    dividend.amount,
    dividend.currency,
  ]);
}

export function trading212CashTransactionExternalId(
  transaction: Trading212HistoryTransaction,
): string {
  return (
    transaction.reference ??
    stableProviderExternalId([
      transaction.dateTime,
      transaction.type,
      transaction.amount,
      transaction.currency,
    ])
  );
}

function normalizeCashTransactionAmount(transaction: Trading212HistoryTransaction): number {
  const type = `${transaction.type ?? ""}`.toUpperCase();
  if (type === "DEPOSIT") {
    return Math.abs(transaction.amount);
  }
  if (type === "WITHDRAW" || type === "FEE") {
    return -Math.abs(transaction.amount);
  }
  return transaction.amount;
}

function calculateTrading212Charges(taxes: Trading212Tax[]): {
  fees: number | null;
  tax: number | null;
} {
  let fees = 0;
  let tax = 0;
  for (const item of taxes) {
    const name = `${item.name ?? ""}`.toUpperCase();
    if (
      name.includes("FEE") ||
      name.includes("COMMISSION") ||
      name.includes("FINRA") ||
      name.includes("LEVY")
    ) {
      fees += item.quantity;
      continue;
    }
    tax += item.quantity;
  }
  return {
    fees: fees === 0 ? null : fees,
    tax: tax === 0 ? null : tax,
  };
}

function stableProviderExternalId(parts: unknown[]): string {
  return parts
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(":")
    .replace(/[^A-Za-z0-9_.:-]+/g, "_");
}

function toIsoDateTime(value: string | null | undefined): string {
  return nullableIsoDateTime(value) ?? new Date(0).toISOString();
}

function nullableIsoDateTime(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
