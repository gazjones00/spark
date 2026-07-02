import { describe, expect, it } from "vitest";

import type { Account } from "@spark/orpc/contract";

import { calculateNetWorth, dominantCurrency } from "./dashboard-derivations";

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
    consentStatus: "ACTIVE",
    consentExpiresAt: null,
    ...overrides,
  };
}

// Monthly totals, category spend, and the balance series moved server-side
// (SQL aggregation over the daily rollups); only the account-derived figures
// remain client-side.

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
