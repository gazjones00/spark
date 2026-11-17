import { Link } from "@tanstack/react-router";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MerchantAvatar } from "@/features/finance/components/MerchantAvatar";
import { useCategories } from "@/features/finance/hooks/useCategories";
import { dayKey, friendlyDay } from "@/features/finance/lib/dates";
import { formatMoney } from "@/features/finance/lib/money";
import { cn } from "@/lib/utils";
import type { Account, SavedTransaction } from "@spark/orpc/contract";

interface RecentActivityProps {
  transactions: SavedTransaction[];
  accounts: Account[];
}

/** The latest transactions, grouped under friendly day headings. */
export function RecentActivity({ transactions, accounts }: RecentActivityProps) {
  const { resolve } = useCategories();
  const accountNames = new Map(accounts.map((account) => [account.accountId, account.displayName]));

  const days: Array<{ key: string; label: string; items: SavedTransaction[] }> = [];
  for (const transaction of transactions) {
    const key = dayKey(transaction.timestamp);
    const day = days.at(-1);
    if (day?.key === key) {
      day.items.push(transaction);
    } else {
      days.push({ key, label: friendlyDay(transaction.timestamp), items: [transaction] });
    }
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Recent activity</CardTitle>
        <Link to="/transactions" className="text-primary text-sm font-medium hover:underline">
          See all
        </Link>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Transactions appear here once your accounts have synced.
          </p>
        ) : (
          <div className="space-y-4">
            {days.map((day) => (
              <section key={day.key}>
                <h3 className="text-muted-foreground mb-1 font-sans text-xs font-medium tracking-normal">
                  {day.label}
                </h3>
                <ul>
                  {day.items.map((transaction) => {
                    const category = resolve(transaction.category);
                    const name =
                      transaction.merchant?.displayName ??
                      transaction.merchantName ??
                      transaction.description;
                    const isIn = transaction.transactionType === "CREDIT";
                    const amount = Math.abs(Number(transaction.amount));
                    return (
                      <li key={transaction.id} className="flex items-center gap-3 py-2">
                        <MerchantAvatar name={name} color={category.color} />
                        <span className="min-w-0 flex-1">
                          <span className="text-foreground block truncate text-sm font-medium">
                            {name}
                          </span>
                          <span className="text-muted-foreground block truncate text-xs">
                            {category.label}
                            {accountNames.get(transaction.accountId)
                              ? ` · ${accountNames.get(transaction.accountId)}`
                              : ""}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "figure text-sm font-medium",
                            isIn ? "text-success" : "text-foreground",
                          )}
                        >
                          {isIn ? "+" : "−"}
                          {formatMoney(amount, transaction.currency)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
