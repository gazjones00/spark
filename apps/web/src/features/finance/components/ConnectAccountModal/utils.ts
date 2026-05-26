import type { Account } from "@spark/truelayer/types";

export function formatAccountNumber(account: Account): string | null {
  if (account.accountNumber.number && account.accountNumber.sortCode) {
    return `${account.accountNumber.sortCode} ${account.accountNumber.number}`;
  }
  if (
    account.accountNumber.number &&
    (account.accountType === "CREDIT_CARD" || account.accountType === "CHARGE_CARD")
  ) {
    const lastFour = account.accountNumber.number.replace(/\D/g, "").slice(-4);
    return `Card ending ••••${lastFour}`;
  }
  if (account.accountNumber.iban) {
    return `IBAN: ...${account.accountNumber.iban.slice(-4)}`;
  }
  return null;
}

export function formatAccountType(type?: string): string | null {
  if (!type) return null;
  return type.replace(/_/g, " ").toLowerCase();
}
