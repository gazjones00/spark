import { FinancialAccountType } from "@spark/schema";

/**
 * Liability accounts report their balance as a positive amount owed
 * (TrueLayer's card convention), so they count against net worth.
 */
export function isLiabilityAccountType(type: FinancialAccountType): boolean {
  return type === FinancialAccountType.Card;
}

/**
 * An account's net-worth-signed balance: assets keep their sign, liabilities
 * are negated (a positive card balance is debt; a negative one — an overpaid
 * card in credit — becomes an asset).
 *
 * `balance` is a nullable Drizzle-numeric string; `null` and malformed values
 * are treated as 0 so one bad row can't poison an aggregate.
 */
export function signedAccountBalance(type: FinancialAccountType, balance: string | null): number {
  const value = balance ? Number(balance) : 0;
  if (Number.isNaN(value) || value === 0) return 0;
  return isLiabilityAccountType(type) ? -value : value;
}
