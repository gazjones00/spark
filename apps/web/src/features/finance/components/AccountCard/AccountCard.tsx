import { Wallet, PiggyBank, Briefcase, Pencil, Trash2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Account } from "@spark/orpc/contract";
import { AccountType } from "@spark/truelayer/types";
import type { AccountType as AccountTypeType } from "@spark/truelayer/types";

const accountTypeConfig: Record<AccountTypeType, { icon: typeof Wallet; label: string }> = {
  TRANSACTION: { icon: Wallet, label: "Current" },
  SAVINGS: { icon: PiggyBank, label: "Savings" },
  BUSINESS_TRANSACTION: { icon: Briefcase, label: "Business" },
  BUSINESS_SAVINGS: { icon: Briefcase, label: "Business Savings" },
};

function getAccountNumber(accountNumber: Account["accountNumber"]): string {
  if (accountNumber.number) {
    return `****${accountNumber.number.slice(-4)}`;
  }
  if (accountNumber.iban) {
    return `****${accountNumber.iban.slice(-4)}`;
  }
  return "";
}

interface AccountCardProps {
  account: Account;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function AccountCard({ account, onEdit, onDelete }: AccountCardProps) {
  const accountType: AccountTypeType = account.accountType ?? AccountType.TRANSACTION;
  const { icon: Icon, label } = accountTypeConfig[accountType];

  return (
    <Card className="h-full transition-colors hover:bg-muted/50">
      <CardContent className="flex h-full flex-col">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-muted rounded-none p-2">
              <Icon className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">{account.displayName}</p>
              <p className="text-muted-foreground text-xs">
                {account.provider.displayName} • {getAccountNumber(account.accountNumber)}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            {label}
          </Badge>
        </div>
        <div className="mt-auto flex items-center justify-between pt-4">
          <p className="text-muted-foreground text-xs">
            Last updated: {new Date(account.updatedAt).toLocaleDateString()}
          </p>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => onEdit?.(account.id)}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-destructive hover:text-destructive"
              onClick={() => onDelete?.(account.id)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
