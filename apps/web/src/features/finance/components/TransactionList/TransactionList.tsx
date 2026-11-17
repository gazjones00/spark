import { Card } from "@/components/ui/card";
import { MerchantAvatar } from "@/features/finance/components/MerchantAvatar";
import { useCategories } from "@/features/finance/hooks/useCategories";
import { dayKey, friendlyDay } from "@/features/finance/lib/dates";
import { formatMoney, formatSignedMoney } from "@/features/finance/lib/money";
import { cn } from "@/lib/utils";
import type { Account, SavedTransaction } from "@spark/orpc/contract";
import { CategoryPicker } from "./CategoryPicker";

export function merchantName(transaction: SavedTransaction): string {
  return transaction.merchant?.displayName ?? transaction.merchantName ?? transaction.description;
}

/** Money in is positive, money out negative, whatever the provider's sign convention. */
export function signedAmount(transaction: SavedTransaction): number {
  const amount = Math.abs(Number(transaction.amount));
  return transaction.transactionType === "CREDIT" ? amount : -amount;
}

interface TransactionListProps {
  transactions: SavedTransaction[];
  accounts: Account[];
  onOpen: (transaction: SavedTransaction) => void;
}

/** Transactions grouped by day, each day with its net total. */
export function TransactionList({ transactions, accounts, onOpen }: TransactionListProps) {
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
    <div className="space-y-4">
      {days.map((day) => {
        const net = day.items.reduce((sum, transaction) => sum + signedAmount(transaction), 0);
        return (
          <section key={day.key} aria-label={day.label}>
            <div className="text-muted-foreground mb-2 flex items-baseline justify-between px-1 text-sm">
              <h2 className="text-foreground font-sans text-sm font-semibold tracking-normal">
                {day.label}
              </h2>
              <span className="tabular-nums">{formatSignedMoney(net, day.items[0]?.currency)}</span>
            </div>
            <Card className="gap-0 py-1">
              <ul className="divide-border divide-y">
                {day.items.map((transaction) => {
                  const name = merchantName(transaction);
                  const amount = signedAmount(transaction);
                  const account = accountNames.get(transaction.accountId);
                  return (
                    <li
                      key={transaction.id}
                      className="hover:bg-muted/60 relative flex items-center gap-3 px-4 py-3"
                    >
                      <MerchantAvatar name={name} color={resolve(transaction.category).color} />
                      <div className="min-w-0 flex-1">
                        {/* Stretched over the row so the whole row opens details,
                            while the category picker stays clickable above it. */}
                        <button
                          type="button"
                          onClick={() => onOpen(transaction)}
                          className="text-foreground focus-visible:ring-ring/50 block w-full truncate rounded-sm text-left text-sm font-semibold outline-none before:absolute before:inset-0 focus-visible:ring-[3px]"
                        >
                          {name}
                        </button>
                        <div className="relative z-10 -ml-2 flex min-w-0 items-center gap-1">
                          <CategoryPicker transaction={transaction} />
                          {account ? (
                            <span className="text-muted-foreground truncate text-xs">
                              · {account}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <span
                        className={cn(
                          "figure shrink-0 text-[0.9375rem] font-semibold",
                          amount > 0 ? "text-success" : "text-foreground",
                        )}
                      >
                        {amount > 0 ? "+" : "−"}
                        {formatMoney(Math.abs(amount), transaction.currency)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </section>
        );
      })}
    </div>
  );
}
