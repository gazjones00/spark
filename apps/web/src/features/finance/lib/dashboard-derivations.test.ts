import { describe, expect, it } from "vitest";

import type { Account, SavedTransaction } from "@spark/orpc/contract";

import {
  calculateMonthlyTotals,
  calculateNetWorth,
  calculateSpendingByCategory,
  deriveBalanceSeries,
  dominantCurrency,
} from "./dashboard-derivations";

// Build timestamps in the same (local) frame the derivations use for the
// first-of-month boundary, so the tests are timezone-independent.
const iso = (year: number, monthIndex: number, day: number, hour = 12): string =>
  new Date(year, monthIndex, day, hour).toISOString();

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    accountId: "acc-1",
    accountType: "TRANSACTION",
    displayName: "Main Checking",
    currency: "GBP",
    accountNumber: { number: "****0001" },
    provider: { providerId: "uk-ob-test", displayName: "Test Bank" },
    updatedAt: iso(2026, 4, 1),
    currentBalance: "0",
    availableBalance: null,
    overdraft: null,
    balanceUpdatedAt: null,
    syncStatus: "OK",
    lastSyncedAt: null,
    ...overrides,
  };
}

function makeTransaction(overrides: Partial<SavedTransaction> = {}): SavedTransaction {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    transactionId: "txn-1",
    accountId: "acc-1",
    normalisedProviderTransactionId: null,
    providerTransactionId: null,
    timestamp: iso(2026, 4, 10),
    description: "Test",
    amount: "0",
    currency: "GBP",
    transactionType: "DEBIT",
    transactionCategory: "PURCHASE",
    transactionClassification: [],
    merchantName: null,
    runningBalance: null,
    meta: null,
    updatedAt: iso(2026, 4, 10),
    ...overrides,
  };
}

describe("calculateNetWorth", () => {
  it("sums currentBalance across accounts", () => {
    const accounts = [
      makeAccount({ currentBalance: "1000.00" }),
      makeAccount({ currentBalance: "2500.50" }),
    ];
    expect(calculateNetWorth(accounts)).toBe(3500.5);
  });

  it("treats a null balance as 0", () => {
    const accounts = [makeAccount({ currentBalance: null }), makeAccount({ currentBalance: "42" })];
    expect(calculateNetWorth(accounts)).toBe(42);
  });

  it("returns 0 for no accounts", () => {
    expect(calculateNetWorth([])).toBe(0);
  });
});

describe("calculateMonthlyTotals", () => {
  const now = new Date(2026, 4, 15); // 15 May 2026

  it("partitions current-month CREDIT/DEBIT and excludes prior months", () => {
    const transactions = [
      makeTransaction({ transactionType: "CREDIT", amount: "100", timestamp: iso(2026, 4, 3) }),
      makeTransaction({ transactionType: "CREDIT", amount: "50", timestamp: iso(2026, 4, 9) }),
      makeTransaction({ transactionType: "DEBIT", amount: "30", timestamp: iso(2026, 4, 12) }),
      // Prior month — must be excluded.
      makeTransaction({ transactionType: "CREDIT", amount: "999", timestamp: iso(2026, 3, 28) }),
      makeTransaction({ transactionType: "DEBIT", amount: "999", timestamp: iso(2026, 3, 30) }),
    ];

    expect(calculateMonthlyTotals(transactions, now)).toEqual({ income: 150, expenses: 30 });
  });

  it("includes a transaction dated exactly on the first of the month", () => {
    const transactions = [
      makeTransaction({ transactionType: "CREDIT", amount: "10", timestamp: iso(2026, 4, 1, 0) }),
    ];
    expect(calculateMonthlyTotals(transactions, now)).toEqual({ income: 10, expenses: 0 });
  });

  it("uses absolute values so stored sign never flips a total", () => {
    const transactions = [
      makeTransaction({ transactionType: "DEBIT", amount: "-30", timestamp: iso(2026, 4, 12) }),
    ];
    expect(calculateMonthlyTotals(transactions, now)).toEqual({ income: 0, expenses: 30 });
  });
});

describe("calculateSpendingByCategory", () => {
  const now = new Date(2026, 4, 15); // 15 May 2026

  it("groups current-month DEBITs, excluding credits and prior months", () => {
    const transactions = [
      makeTransaction({
        transactionType: "DEBIT",
        transactionCategory: "PURCHASE",
        amount: "40",
        timestamp: iso(2026, 4, 5),
      }),
      makeTransaction({
        transactionType: "DEBIT",
        transactionCategory: "PURCHASE",
        amount: "10",
        timestamp: iso(2026, 4, 9),
      }),
      makeTransaction({
        transactionType: "DEBIT",
        transactionCategory: "DIRECT_DEBIT",
        amount: "25",
        timestamp: iso(2026, 4, 12),
      }),
      // A credit must not appear in spending.
      makeTransaction({
        transactionType: "CREDIT",
        transactionCategory: "CREDIT",
        amount: "500",
        timestamp: iso(2026, 4, 8),
      }),
      // A prior-month debit must be excluded from the window.
      makeTransaction({
        transactionType: "DEBIT",
        transactionCategory: "PURCHASE",
        amount: "999",
        timestamp: iso(2026, 3, 28),
      }),
    ];

    expect(calculateSpendingByCategory(transactions, now)).toEqual([
      { category: "PURCHASE", amount: 50 },
      { category: "DIRECT_DEBIT", amount: 25 },
    ]);
  });
});

describe("deriveBalanceSeries", () => {
  // Use explicit UTC timestamps: the series buckets by the UTC date portion of
  // the ISO string, so literals keep the asserted dates timezone-independent.
  it("uses the most recent runningBalance per day, carrying forward gaps", () => {
    const transactions = [
      makeTransaction({
        timestamp: "2026-05-01T09:00:00.000Z",
        runningBalance: { amount: 100, currency: "GBP" },
      }),
      makeTransaction({
        timestamp: "2026-05-01T17:00:00.000Z",
        runningBalance: { amount: 150, currency: "GBP" },
      }),
      // Day with no running balance — carries 150 forward.
      makeTransaction({ timestamp: "2026-05-02T12:00:00.000Z", runningBalance: null }),
      makeTransaction({
        timestamp: "2026-05-03T12:00:00.000Z",
        runningBalance: { amount: 200, currency: "GBP" },
      }),
    ];

    expect(deriveBalanceSeries(transactions)).toEqual([
      { date: "2026-05-01", balance: 150 },
      { date: "2026-05-02", balance: 150 },
      { date: "2026-05-03", balance: 200 },
    ]);
  });

  it("returns an empty series when no transaction has a running balance", () => {
    const transactions = [
      makeTransaction({ timestamp: "2026-05-01T12:00:00.000Z", runningBalance: null }),
      makeTransaction({ timestamp: "2026-05-02T12:00:00.000Z", runningBalance: null }),
    ];
    expect(deriveBalanceSeries(transactions)).toEqual([]);
  });
});

describe("dominantCurrency", () => {
  it("returns the most common account currency", () => {
    const accounts = [
      makeAccount({ currency: "GBP" }),
      makeAccount({ currency: "GBP" }),
      makeAccount({ currency: "USD" }),
    ];
    expect(dominantCurrency(accounts)).toBe("GBP");
  });

  it("returns undefined for no accounts", () => {
    expect(dominantCurrency([])).toBeUndefined();
  });
});
