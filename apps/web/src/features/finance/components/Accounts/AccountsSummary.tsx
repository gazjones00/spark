import { Card, CardContent } from "@/components/ui/card";
import { accountBalance, isCardAccount } from "@/features/finance/lib/account-groups";
import { formatMoney } from "@/features/finance/lib/money";
import { cn } from "@/lib/utils";
import type { Account } from "@spark/orpc/contract";

/** What you have, what you owe, and the difference. */
export function AccountsSummary({
  accounts,
  currency,
}: {
  accounts: Account[];
  currency?: string;
}) {
  const inCurrency = accounts.filter((account) => !currency || account.currency === currency);
  const owed = inCurrency
    .filter(isCardAccount)
    .reduce((sum, account) => sum + accountBalance(account), 0);
  const held = inCurrency
    .filter((account) => !isCardAccount(account))
    .reduce((sum, account) => sum + accountBalance(account), 0);

  const tiles = [
    { label: "You have", value: held, note: "Current and savings" },
    { label: "You owe", value: owed, note: "Credit cards" },
    { label: "Net worth", value: held - owed, note: "Have minus owe", primary: true },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {tiles.map((tile) => (
        <Card key={tile.label} className={cn(tile.primary && "border-primary/40")}>
          <CardContent>
            <p className="text-muted-foreground text-sm font-medium">{tile.label}</p>
            <p
              className={cn(
                "figure mt-1 w-fit text-2xl font-medium",
                tile.primary && "text-ignition",
              )}
            >
              {formatMoney(tile.value, currency)}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">{tile.note}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
