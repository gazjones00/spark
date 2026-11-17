import { Link, useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeftRight, MoreHorizontal, Pencil, RefreshCw, Trash2 } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BankLogo } from "@/features/finance/components/BankLogo";
import {
  accountBalance,
  bankName,
  isCardAccount,
  type AccountGroup,
} from "@/features/finance/lib/account-groups";
import { formatMoney } from "@/features/finance/lib/money";
import { cn } from "@/lib/utils";
import type { Account } from "@spark/orpc/contract";

interface AccountGroupCardProps {
  group: AccountGroup;
  currency?: string;
  onRename: (account: Account) => void;
  onRemove: (account: Account) => void;
  onReconnect: (account: Account) => void;
}

/** One kind of account (current, savings or cards) with its subtotal. */
export function AccountGroupCard({
  group,
  currency,
  onRename,
  onRemove,
  onReconnect,
}: AccountGroupCardProps) {
  return (
    <Card className="gap-2 pb-2">
      <CardHeader className="flex items-baseline justify-between">
        <h2 className="text-foreground text-base font-semibold">{group.label}</h2>
        <p className="figure text-foreground text-base font-bold">
          {formatMoney(group.total, currency)}
          {group.key === "credit" ? (
            <span className="text-muted-foreground ml-1 font-sans text-sm font-medium">owed</span>
          ) : null}
        </p>
      </CardHeader>
      <CardContent className="px-2 sm:px-3">
        <ul className="divide-border divide-y">
          {group.accounts.map((account) => (
            <AccountRow
              key={account.id}
              account={account}
              onRename={onRename}
              onRemove={onRemove}
              onReconnect={onReconnect}
            />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function AccountRow({
  account,
  onRename,
  onRemove,
  onReconnect,
}: {
  account: Account;
  onRename: (account: Account) => void;
  onRemove: (account: Account) => void;
  onReconnect: (account: Account) => void;
}) {
  const navigate = useNavigate();
  const card = isCardAccount(account);
  const balance = accountBalance(account);
  const available = account.availableBalance ? Number(account.availableBalance) : undefined;
  const needsReconnect = account.syncStatus !== "OK" || account.consentStatus === "EXPIRING_SOON";

  return (
    <li className="flex items-center gap-3 py-1">
      <Link
        to="/transactions"
        search={{ account: account.accountId }}
        className="hover:bg-muted flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-3"
      >
        <BankLogo provider={account.provider} className="size-10" />
        <span className="min-w-0 flex-1">
          <span className="text-foreground block truncate text-[0.9375rem] font-semibold">
            {account.displayName}
          </span>
          <span className="text-muted-foreground block truncate text-sm">
            {bankName(account)}
            {maskedNumber(account) ? ` · ${maskedNumber(account)}` : ""}
          </span>
          <SyncLine account={account} />
        </span>
        <span className="text-right">
          <span className="figure text-foreground block text-lg font-bold">
            {formatMoney(balance, account.currency)}
          </span>
          {card ? (
            <span className="text-muted-foreground block text-xs">
              owed
              {available !== undefined && available !== balance
                ? ` · ${formatMoney(available, account.currency)} available`
                : ""}
            </span>
          ) : account.availableBalance && available !== balance ? (
            <span className="text-muted-foreground block text-xs">
              {formatMoney(available ?? 0, account.currency)} available
            </span>
          ) : null}
        </span>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Actions for ${account.displayName}`}
          className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 inline-flex size-9 shrink-0 items-center justify-center rounded-lg outline-none focus-visible:ring-[3px]"
        >
          <MoreHorizontal className="size-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem
            onClick={() =>
              navigate({ to: "/transactions", search: { account: account.accountId } })
            }
          >
            <ArrowLeftRight />
            View transactions
          </DropdownMenuItem>
          {needsReconnect ? (
            <DropdownMenuItem onClick={() => onReconnect(account)}>
              <RefreshCw />
              Reconnect
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={() => onRename(account)}>
            <Pencil />
            Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => onRemove(account)}>
            <Trash2 />
            Remove from Spark
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function maskedNumber(account: Account): string | undefined {
  const digits = account.accountNumber.number ?? account.accountNumber.iban;
  return digits ? `••${digits.slice(-4)}` : undefined;
}

/** Freshness, or what needs doing, in one short line. */
function SyncLine({ account }: { account: Account }) {
  let text: string;
  let tone = "text-muted-foreground";
  if (account.syncStatus === "NEEDS_REAUTH") {
    text = "Reconnect needed — syncing has stopped";
    tone = "text-destructive";
  } else if (account.syncStatus === "ERROR") {
    text = "Last sync failed — retrying automatically";
    tone = "text-warning-foreground";
  } else if (account.consentStatus === "EXPIRING_SOON" && account.consentExpiresAt) {
    text = `Bank access expires ${formatDistanceToNow(new Date(account.consentExpiresAt), { addSuffix: true })}`;
    tone = "text-warning-foreground";
  } else if (account.lastSyncedAt) {
    text = `Updated ${formatDistanceToNow(new Date(account.lastSyncedAt), { addSuffix: true })}`;
  } else {
    text = "Waiting for first sync";
  }
  return <span className={cn("mt-0.5 block truncate text-xs", tone)}>{text}</span>;
}
