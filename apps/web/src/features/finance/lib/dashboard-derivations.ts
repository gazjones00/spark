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

/** Spending grouped by category before a colour is attached. */
export interface CategorySpend {
  category: TransactionCategory;
  amount: number;
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
 * Income and expenses for the calendar month containing `now`.
 *
 * Includes transactions on or after the first of the month (inclusive) and
 * partitions them by `transactionType`. Amounts are unsigned in storage, so we
 * sum `Math.abs(Number(amount))`.
 */
export function calculateMonthlyTotals(
  transactions: SavedTransaction[],
  now: Date,
): { income: number; expenses: number } {
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  let income = 0;
  let expenses = 0;

  for (const transaction of transactions) {
    if (new Date(transaction.timestamp) < firstOfMonth) continue;
    const amount = Math.abs(Number(transaction.amount));
    if (Number.isNaN(amount)) continue;

    if (transaction.transactionType === "CREDIT") {
      income += amount;
    } else if (transaction.transactionType === "DEBIT") {
      expenses += amount;
    }
  }

  return { income, expenses };
}

/**
 * Spending grouped by category, derived from current-month DEBIT transactions.
 *
 * Windowed to the calendar month containing `now` so the breakdown stays
 * consistent with the "Expenses (This Month)" figure from
 * {@link calculateMonthlyTotals} (the pie total equals monthly expenses).
 * Amounts are summed as `Math.abs(Number(amount))`. Sorted desc by amount.
 */
export function calculateSpendingByCategory(
  transactions: SavedTransaction[],
  now: Date,
): CategorySpend[] {
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const totals = new Map<TransactionCategory, number>();

  for (const transaction of transactions) {
    if (transaction.transactionType !== "DEBIT") continue;
    if (new Date(transaction.timestamp) < firstOfMonth) continue;
    const amount = Math.abs(Number(transaction.amount));
    if (Number.isNaN(amount)) continue;

    totals.set(
      transaction.transactionCategory,
      (totals.get(transaction.transactionCategory) ?? 0) + amount,
    );
  }

  return [...totals.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Daily balance series derived client-side from `runningBalance`.
 *
 * For each calendar day (UTC) with transactions, use the most recent
 * `runningBalance` of that day; days whose transactions all lack a running
 * balance carry the last known value forward. If no transaction anywhere has a
 * `runningBalance`, returns an empty array — the caller must then render an
 * explicit empty state rather than a fabricated curve.
 */
export function deriveBalanceSeries(transactions: SavedTransaction[]): BalanceHistory[] {
  const byDay = new Map<string, SavedTransaction[]>();
  for (const transaction of transactions) {
    const day = transaction.timestamp.slice(0, 10);
    const bucket = byDay.get(day);
    if (bucket) {
      bucket.push(transaction);
    } else {
      byDay.set(day, [transaction]);
    }
  }

  const days = [...byDay.keys()].sort();
  const series: BalanceHistory[] = [];
  let lastKnown: number | undefined;

  for (const day of days) {
    const withBalance = byDay
      .get(day)!
      .filter((transaction) => transaction.runningBalance != null)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    if (withBalance.length > 0) {
      lastKnown = withBalance[withBalance.length - 1].runningBalance!.amount;
    }

    if (lastKnown !== undefined) {
      series.push({ date: day, balance: lastKnown });
    }
  }

  return series;
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
