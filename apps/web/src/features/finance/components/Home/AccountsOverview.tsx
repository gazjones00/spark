import { Link } from "@tanstack/react-router";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BankLogo } from "@/features/finance/components/BankLogo";
import {
  accountBalance,
  bankName,
  groupAccounts,
  isCardAccount,
} from "@/features/finance/lib/account-groups";
import { formatMoney } from "@/features/finance/lib/money";
import type { Account } from "@spark/orpc/contract";

/** Every account at a glance, grouped, with anything needing attention flagged. */
export function AccountsOverview({
  accounts,
  currency,
}: {
  accounts: Account[];
  currency?: string;
}) {
  const groups = groupAccounts(accounts);
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Accounts</CardTitle>
        <Link to="/accounts" className="text-primary text-sm font-medium hover:underline">
          Manage
        </Link>
      </CardHeader>
      <CardContent className="space-y-5">
        {groups.map((group) => (
          <section key={group.key}>
            <div className="text-muted-foreground mb-1.5 flex items-baseline justify-between text-xs font-medium">
              <span>{group.label}</span>
              <span className="tabular-nums">
                {formatMoney(group.total, currency)}
                {group.key === "credit" ? " owed" : ""}
              </span>
            </div>
            <ul className="-mx-2">
              {group.accounts.map((account) => (
                <li key={account.id}>
                  <Link
                    to="/transactions"
                    search={{ account: account.accountId }}
                    className="hover:bg-muted flex items-center gap-3 rounded-lg px-2 py-2"
                  >
                    <BankLogo provider={account.provider} className="size-8 rounded-lg" />
                    <span className="min-w-0 flex-1">
                      <span className="text-foreground block truncate text-sm font-medium">
                        {account.displayName}
                      </span>
                      <span className="text-muted-foreground flex items-center gap-1.5 truncate text-xs">
                        {bankName(account)}
                        <AccountStatus account={account} />
                      </span>
                    </span>
                    <span className="figure text-foreground text-right text-sm font-medium">
                      {formatMoney(accountBalance(account), account.currency)}
                      {isCardAccount(account) ? (
                        <span className="text-muted-foreground block text-[11px] font-medium">
                          owed
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}

/** A short status after the bank name when the account needs attention. */
function AccountStatus({ account }: { account: Account }) {
  const status =
    account.syncStatus === "NEEDS_REAUTH"
      ? { label: "Reconnect needed", tone: "text-destructive" }
      : account.syncStatus === "ERROR"
        ? { label: "Sync issue", tone: "text-warning-foreground" }
        : account.consentStatus === "EXPIRING_SOON"
          ? { label: "Access expires soon", tone: "text-warning-foreground" }
          : null;
  if (!status) return null;
  return (
    <span className={`inline-flex items-center gap-1 font-medium ${status.tone}`}>
      <span aria-hidden="true">·</span>
      {status.label}
    </span>
  );
}
