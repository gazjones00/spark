import { useNavigate } from "@tanstack/react-router";
import { Search, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { BankLogo } from "@/features/finance/components/BankLogo";
import { MerchantAvatar } from "@/features/finance/components/MerchantAvatar";
import { useCategories } from "@/features/finance/hooks/useCategories";
import { bankName } from "@/features/finance/lib/account-groups";
import { formatMoney } from "@/features/finance/lib/money";
import { cn } from "@/lib/utils";
import type { Account, SavedTransaction } from "@spark/orpc/contract";
import { CategoryPicker } from "./CategoryPicker";
import { merchantName, signedAmount } from "./TransactionList";

interface TransactionDetailSheetProps {
  transaction: SavedTransaction | null;
  accounts: Account[];
  onOpenChange: (open: boolean) => void;
  /** Search the list for this merchant. */
  onShowMerchant: (name: string) => void;
}

function humanise(value: string): string {
  const lower = value.replace(/_/g, " ").toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** Everything about one transaction, and the one thing you can change: its category. */
export function TransactionDetailSheet({
  transaction,
  accounts,
  onOpenChange,
  onShowMerchant,
}: TransactionDetailSheetProps) {
  const { resolve } = useCategories();

  return (
    <Sheet open={transaction !== null} onOpenChange={onOpenChange}>
      <SheetContent>
        {transaction ? (
          <Details
            transaction={transaction}
            account={accounts.find((account) => account.accountId === transaction.accountId)}
            color={resolve(transaction.category).color}
            onShowMerchant={onShowMerchant}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Details({
  transaction,
  account,
  color,
  onShowMerchant,
}: {
  transaction: SavedTransaction;
  account: Account | undefined;
  color: string;
  onShowMerchant: (name: string) => void;
}) {
  const name = merchantName(transaction);
  const amount = signedAmount(transaction);
  const when = new Date(transaction.timestamp);
  const manual = transaction.categorySource === "USER_OVERRIDE";
  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <SheetHeader className="items-start gap-3">
        <MerchantAvatar name={name} color={color} className="size-12 text-lg" />
        <div>
          <SheetTitle className="text-xl">{name}</SheetTitle>
          <SheetDescription>
            {when.toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            {" · "}
            {when.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </SheetDescription>
        </div>
        <p
          className={cn(
            "figure text-4xl font-medium",
            amount > 0 ? "text-success" : "text-foreground",
          )}
        >
          {amount > 0 ? "+" : "−"}
          {formatMoney(Math.abs(amount), transaction.currency)}
        </p>
      </SheetHeader>

      <div className="space-y-6 px-6 py-6">
        <div className="space-y-2">
          <p className="text-foreground text-sm font-semibold">Category</p>
          <CategoryPicker transaction={transaction} variant="field" />
          <p className="text-muted-foreground text-xs">
            {manual
              ? "You chose this category, so rules won't change it. Pick “Reset to automatic” to let them apply again."
              : "Set automatically. Choosing one yourself overrides rules for this transaction."}
          </p>
        </div>

        <dl className="border-border divide-border divide-y rounded-xl border">
          {account ? (
            <Row label="Account">
              {/* Name over bank, like account rows elsewhere: the full name is
                  always readable, on any device, and nothing is cut off. */}
              <span className="flex min-w-0 items-start justify-end gap-2.5">
                <BankLogo
                  provider={account.provider}
                  className="mt-0.5 size-5 shrink-0 rounded-[6px]"
                />
                <span className="min-w-0">
                  <span className="block break-words">{account.displayName}</span>
                  <span className="text-muted-foreground block text-xs break-words">
                    {bankName(account)}
                  </span>
                </span>
              </span>
            </Row>
          ) : null}
          <Row label="Type">{amount > 0 ? "Money in" : "Money out"}</Row>
          <Row label="Bank's category">{humanise(transaction.transactionCategory)}</Row>
          <Row label="Description">
            <span className="break-words">{transaction.description}</span>
          </Row>
          {transaction.meta?.providerReference ? (
            <Row label="Reference">
              <span className="break-all">{transaction.meta.providerReference}</span>
            </Row>
          ) : null}
        </dl>

        <Button variant="outline" className="w-full" onClick={() => onShowMerchant(name)}>
          <Search />
          Show all from {name}
        </Button>
        <Button
          variant="ghost"
          className="w-full"
          onClick={() =>
            navigate({
              to: "/settings/rules",
              search: { merchant: name, category: transaction.category },
            })
          }
        >
          <Wand2 />
          Create a rule for {name}
        </Button>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="text-foreground min-w-0 text-right">{children}</dd>
    </div>
  );
}
