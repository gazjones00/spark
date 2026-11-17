import type { Account } from "@spark/orpc/contract";

export type AccountGroupKey = "cash" | "savings" | "credit";

export interface AccountGroup {
  key: AccountGroupKey;
  label: string;
  accounts: Account[];
  /** Sum of balances as the bank reports them (for cards: total owed). */
  total: number;
}

const GROUP_LABELS: Record<AccountGroupKey, string> = {
  cash: "Current accounts",
  savings: "Savings",
  credit: "Credit cards",
};

/** Cards report their balance as the positive amount owed. */
export function isCardAccount(account: Pick<Account, "accountType">): boolean {
  return account.accountType === "CREDIT_CARD" || account.accountType === "CHARGE_CARD";
}

export function accountGroupKey(account: Pick<Account, "accountType">): AccountGroupKey {
  if (isCardAccount(account)) return "credit";
  if (account.accountType === "SAVINGS" || account.accountType === "BUSINESS_SAVINGS") {
    return "savings";
  }
  return "cash";
}

export function accountBalance(account: Pick<Account, "currentBalance">): number {
  const value = account.currentBalance ? Number(account.currentBalance) : 0;
  return Number.isNaN(value) ? 0 : value;
}

/** Accounts grouped as people think of them: everyday, savings, then debt. */
export function groupAccounts(accounts: readonly Account[]): AccountGroup[] {
  const order: AccountGroupKey[] = ["cash", "savings", "credit"];
  return order
    .map((key) => {
      const members = accounts.filter((account) => accountGroupKey(account) === key);
      return {
        key,
        label: GROUP_LABELS[key],
        accounts: members,
        total: members.reduce((sum, account) => sum + accountBalance(account), 0),
      };
    })
    .filter((group) => group.accounts.length > 0);
}

/** "Personal Account · Monzo" style secondary line. */
export function bankName(account: Pick<Account, "provider">): string {
  const name = account.provider.displayName ?? "";
  return name.length <= 4 ? name.toUpperCase() : name.charAt(0) + name.slice(1).toLowerCase();
}
