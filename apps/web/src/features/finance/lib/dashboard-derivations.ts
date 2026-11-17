import { signedAccountBalance } from "@spark/common";
import type { Account } from "@spark/orpc/contract";

/** A single point on the "Net worth over time" chart. */
export interface BalanceHistory {
  date: string;
  balance: number;
}

/** A slice of the "Spending by Category" pie, resolved for display. */
export interface SpendingByCategory {
  /** Enriched category reference: built-in value or custom category id. */
  category: string;
  label: string;
  amount: number;
  fill: string;
}

/**
 * Net worth = assets minus liabilities: every account's net-worth-signed
 * `currentBalance` (card balances are amounts owed, so they subtract).
 *
 * NOTE: values are summed in their raw numeric form regardless of currency.
 * True multi-currency net worth needs FX conversion, which is out of scope for
 * v1. When accounts span currencies the figure is only
 * meaningful if one currency dominates — surface it labelled with
 * {@link dominantCurrency}.
 */
export function calculateNetWorth(accounts: Account[]): number {
  return accounts.reduce(
    (sum, account) => sum + signedAccountBalance(account.type, account.currentBalance),
    0,
  );
}

/**
 * The most common account currency, used to label aggregate figures.
 * Returns `undefined` when there are no accounts (the caller renders an empty
 * state in that case, so no currency is needed).
 */
export function dominantCurrency(accounts: Account[]): string | undefined {
  const counts = new Map<string, number>();
  for (const account of accounts) {
    counts.set(account.currency, (counts.get(account.currency) ?? 0) + 1);
  }

  let dominant: string | undefined;
  let max = 0;
  for (const [currency, count] of counts) {
    if (count > max) {
      max = count;
      dominant = currency;
    }
  }

  return dominant;
}
