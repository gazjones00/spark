import { describe, expect, it } from "vitest";
import {
  FinancialTransactionType,
  InstrumentType,
  ConnectorManifestSchema,
} from "../core/index.ts";
import { TRADING212_MANIFEST } from "./constants.ts";
import {
  mapTrading212Account,
  mapTrading212BalanceSnapshot,
  mapTrading212CashTransaction,
  mapTrading212DividendTransaction,
  mapTrading212Holding,
  mapTrading212Instrument,
  mapTrading212OrderTransaction,
  mapTrading212PortfolioSnapshot,
} from "./mappers.ts";
import {
  trading212AccountSummaryFixture,
  trading212BuyOrderFixture,
  trading212CashTransactionFixture,
  trading212DividendFixture,
  trading212InstrumentFixture,
  trading212PositionFixture,
} from "./testing/fixtures/trading212.fixtures.ts";

describe("Trading 212 mappers", () => {
  const observedAt = "2026-01-30T10:00:00Z";

  it("exposes a valid connector manifest", () => {
    const manifest = ConnectorManifestSchema.parse(TRADING212_MANIFEST);

    expect(manifest.id).toBe("trading212");
    expect(manifest.readOnly).toBe(true);
    expect(manifest.capabilities).toContain("holdings:sync");
  });

  it("maps account cash into account, balance and portfolio records", () => {
    const account = mapTrading212Account(trading212AccountSummaryFixture);
    const balance = mapTrading212BalanceSnapshot(trading212AccountSummaryFixture, observedAt);
    const portfolio = mapTrading212PortfolioSnapshot(trading212AccountSummaryFixture, observedAt);

    expect(account.externalId).toBe("trading212:account:123456");
    expect(balance.cash).toBe(1035);
    expect(balance.total).toBe(6285);
    expect(portfolio.investmentValue).toBe(5250);
  });

  it("maps positions into instruments and holdings", () => {
    const instrument = mapTrading212Instrument(trading212InstrumentFixture);
    const holding = mapTrading212Holding(
      trading212AccountSummaryFixture,
      trading212PositionFixture,
      observedAt,
    );

    expect(instrument.type).toBe(InstrumentType.Stock);
    expect(holding.instrumentExternalId).toBe("trading212:instrument:AAPL_US_EQ");
    expect(holding.value).toBe(360);
    expect(holding.unrealizedProfitLoss).toBe(60);
  });

  it("maps orders, dividends and cash movements into the unified ledger", () => {
    const order = mapTrading212OrderTransaction(
      trading212AccountSummaryFixture,
      trading212BuyOrderFixture,
    );
    const dividend = mapTrading212DividendTransaction(
      trading212AccountSummaryFixture,
      trading212DividendFixture,
    );
    const cashTransaction = mapTrading212CashTransaction(
      trading212AccountSummaryFixture,
      trading212CashTransactionFixture,
    );

    expect(order.type).toBe(FinancialTransactionType.Buy);
    expect(order.amount).toBe(-300);
    expect(order.fees).toBe(1.5);
    expect(order.tax).toBe(0.5);
    expect(dividend.type).toBe(FinancialTransactionType.Dividend);
    expect(dividend.price).toBe(2.1);
    expect(cashTransaction.type).toBe(FinancialTransactionType.Deposit);
  });
});
