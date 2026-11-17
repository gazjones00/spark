import { isLiabilityAccountType } from "@spark/common";
import { FinancialAccountTypeSchema } from "@spark/schema";

/** One account's latest known balance: the point its history is rebuilt from. */
export interface SeriesAccount {
  key: string;
  type: string;
  currency: string;
  /** Latest balance snapshot, provider-signed (a card's is the amount owed). */
  anchorBalance: string;
  /** UTC day (YYYY-MM-DD) the anchor balance was observed. */
  anchorDay: string;
}

/** Net provider-signed transaction amount for one account on one UTC day. */
export interface DailyMovement {
  key: string;
  day: string;
  amount: string;
}

export interface SeriesPoint {
  date: string;
  balance: string;
  currency: string;
}

/**
 * Net worth per day across every account, rebuilt from each account's latest
 * balance by applying or undoing the transactions between that day and it.
 *
 * Providers only sometimes send running balances, so history can't rely on
 * them; the anchor (the same snapshot the accounts list shows) plus the
 * synced transactions works for every account. Transaction amounts share the
 * balance's sign convention (for a card both are "amount owed"), so
 *
 *   balance(day) = anchor + moved(up to day) − moved(up to anchor day)
 *
 * holds on either side of the anchor. Liabilities are then negated, and only
 * accounts in the dominant currency are summed (there is no FX conversion).
 * `movements` must cover every day from the earlier of the window start and
 * each account's anchor day.
 */
export function reconstructBalanceSeries(
  accounts: readonly SeriesAccount[],
  movements: readonly DailyMovement[],
  window: { from: string; to: string },
): SeriesPoint[] {
  const currency = dominantCurrency(accounts);
  if (!currency) {
    return [];
  }
  const days = eachDay(window.from, window.to);
  const totals = days.map(() => 0);

  for (const account of accounts.filter((a) => a.currency === currency)) {
    const own = movements
      .filter((movement) => movement.key === account.key)
      .map((movement) => ({ day: movement.day, cents: toCents(movement.amount) }));
    const movedUpTo = (day: string) =>
      own.reduce((sum, movement) => (movement.day <= day ? sum + movement.cents : sum), 0);

    const anchor = toCents(account.anchorBalance) - movedUpTo(account.anchorDay);
    const sign = isLiability(account.type) ? -1 : 1;
    days.forEach((day, index) => {
      totals[index] = (totals[index] ?? 0) + sign * (anchor + movedUpTo(day));
    });
  }

  return days.map((day, index) => ({
    date: day,
    balance: ((totals[index] ?? 0) / 100).toFixed(2),
    currency,
  }));
}

/** The earliest day `movements` must start from for these accounts. */
export function movementsFrom(accounts: readonly SeriesAccount[], windowFrom: string): string {
  return accounts.reduce(
    (earliest, a) => (a.anchorDay < earliest ? a.anchorDay : earliest),
    windowFrom,
  );
}

function isLiability(type: string): boolean {
  const parsed = FinancialAccountTypeSchema.safeParse(type);
  return parsed.success && isLiabilityAccountType(parsed.data);
}

function dominantCurrency(accounts: readonly SeriesAccount[]): string | undefined {
  const counts = new Map<string, number>();
  for (const account of accounts) {
    counts.set(account.currency, (counts.get(account.currency) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).at(0)?.[0];
}

function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  const end = Date.parse(`${to}T00:00:00Z`);
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= end; t += 86_400_000) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }
  return days;
}

function toCents(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}
