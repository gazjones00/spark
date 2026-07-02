import type { Account, SavedTransaction } from "@spark/orpc/contract";

type TransactionCategory = SavedTransaction["transactionCategory"];

/** A single point on the "Balance Over Time" chart. */
export interface BalanceHistory {
  date: string;
  balance: number;
}

/** A slice of the "Spending by Category" pie. `fill` is attached downstream. */
export interface SpendingByCategory {
  category: TransactionCategory;
  amount: number;
  fill: string;
}

/**
 * Net worth = sum of every account's `currentBalance`.
 *
 * `currentBalance` is a nullable Drizzle-numeric string; `null` is treated as 0.
 *
 * NOTE: values are summed in their raw numeric form regardless of currency.
 * True multi-currency net worth needs FX conversion, which is out of scope for
 * v1. When accounts span currencies the figure is only
 * meaningful if one currency dominates — surface it labelled with
 * {@link dominantCurrency}.
 */
export function calculateNetWorth(accounts: Account[]): number {
  return accounts.reduce((sum, account) => {
    const value = account.currentBalance ? Number(account.currentBalance) : 0;
    // Guard against malformed numeric strings so one bad row can't poison the sum.
    return sum + (Number.isNaN(value) ? 0 : value);
  }, 0);
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
