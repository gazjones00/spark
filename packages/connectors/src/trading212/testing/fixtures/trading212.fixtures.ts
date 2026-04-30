import type {
  Trading212Dividend,
  Trading212HistoricalOrder,
  Trading212HistoryTransaction,
  Trading212Instrument,
  Trading212AccountSummary,
  Trading212Position,
} from "../../schemas.ts";

export const trading212AccountSummaryFixture: Trading212AccountSummary = {
  id: 123456,
  currency: "GBP",
  cash: {
    availableToTrade: 1000,
    inPies: 10,
    reservedForOrders: 25,
  },
  investments: {
    currentValue: 5250,
    realizedProfitLoss: 75,
    totalCost: 5000,
    unrealizedProfitLoss: 250,
  },
  totalValue: 6285,
};

export const trading212InstrumentFixture: Trading212Instrument = {
  ticker: "AAPL_US_EQ",
  name: "Apple",
  isin: "US0378331005",
  currencyCode: "USD",
  type: "STOCK",
};

export const trading212PositionFixture: Trading212Position = {
  averagePricePaid: 150,
  createdAt: "2026-01-10T10:00:00Z",
  currentPrice: 180,
  instrument: trading212InstrumentFixture,
  quantity: 2,
  quantityAvailableForTrading: 1.5,
  quantityInPies: 0.5,
  walletImpact: {
    currency: "GBP",
    currentValue: 360,
    totalCost: 300,
    unrealizedProfitLoss: 60,
  },
};

export const trading212BuyOrderFixture: Trading212HistoricalOrder = {
  order: {
    id: 987654321,
    createdAt: "2026-01-11T09:59:00Z",
    currency: "GBP",
    filledQuantity: 2,
    filledValue: 300,
    instrument: trading212InstrumentFixture,
    quantity: 2,
    side: "BUY",
    status: "FILLED",
    ticker: "AAPL_US_EQ",
    type: "MARKET",
  },
  fill: {
    id: 987654320,
    filledAt: "2026-01-11T10:00:00Z",
    price: 150,
    quantity: 2,
    tradingMethod: "OTC",
    type: "TRADE",
    walletImpact: {
      currency: "GBP",
      fxRate: 0.8,
      netValue: 300,
      realisedProfitLoss: 0,
      taxes: [
        {
          chargedAt: "2026-01-11T10:00:00Z",
          currency: "GBP",
          name: "TRANSACTION_FEE",
          quantity: 1.5,
        },
        {
          chargedAt: "2026-01-11T10:00:00Z",
          currency: "GBP",
          name: "STAMP_DUTY",
          quantity: 0.5,
        },
      ],
    },
  },
};

export const trading212DividendFixture: Trading212Dividend = {
  amount: 4.2,
  amountInEuro: 4.8,
  currency: "GBP",
  grossAmountPerShare: 2.1,
  paidOn: "2026-01-12T10:00:00Z",
  ticker: "AAPL_US_EQ",
  tickerCurrency: "USD",
  type: "DIVIDEND",
  reference: "Apple dividend",
  quantity: 2,
  instrument: trading212InstrumentFixture,
};

export const trading212CashTransactionFixture: Trading212HistoryTransaction = {
  amount: 100,
  currency: "GBP",
  dateTime: "2026-01-13T10:00:00Z",
  reference: "cash-transaction-555",
  type: "DEPOSIT",
};
