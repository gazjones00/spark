import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Account } from "@spark/orpc/contract";

interface AccountsAttentionBannerProps {
  accounts: Account[];
  /** Still syncing fine, but consent is estimated to expire soon. */
  expiringAccounts?: Account[];
  onReauth: (providerId?: string) => void;
}

function accountNames(accounts: Account[]): string {
  const displayNames = accounts.slice(0, 3).map((a) => a.displayName);
  const remaining = accounts.length - 3;
  return remaining > 0 ? `${displayNames.join(", ")} +${remaining} more` : displayNames.join(", ");
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function AccountsAttentionBanner({
  accounts,
  expiringAccounts = [],
  onReauth,
}: AccountsAttentionBannerProps) {
  if (accounts.length === 0 && expiringAccounts.length === 0) return null;

  return (
    <div className="space-y-3">
      {accounts.length > 0 ? (
        <AttentionCard
          tone="problem"
          icon={AlertTriangle}
          title={`${plural(accounts.length, "account needs", "accounts need")} attention`}
          description={`${accountNames(accounts)} stopped syncing. Reconnecting usually fixes it, and your history is kept.`}
          onAction={() => onReauth(accounts[0]?.provider.providerId)}
        />
      ) : null}

      {expiringAccounts.length > 0 ? (
        <AttentionCard
          tone="warning"
          icon={Clock}
          title={`${plural(expiringAccounts.length, "account", "accounts")} to reconnect soon`}
          description={`Bank access for ${accountNames(expiringAccounts)} expires soon — reconnect anytime to keep syncing without interruption.`}
          onAction={() => onReauth(expiringAccounts[0]?.provider.providerId)}
        />
      ) : null}
    </div>
  );
}

/** Icon, wrapping text and the action: side by side on wide screens, stacked on phones. */
function AttentionCard({
  tone,
  icon: Icon,
  title,
  description,
  onAction,
}: {
  tone: "problem" | "warning";
  icon: LucideIcon;
  title: string;
  description: string;
  onAction: () => void;
}) {
  const problem = tone === "problem";
  return (
    <div
      role={problem ? "alert" : "status"}
      className={cn(
        "flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:gap-4",
        problem ? "border-destructive/30 bg-destructive/5" : "border-warning/45 bg-warning/8",
      )}
    >
      <div className="flex min-w-0 flex-1 gap-3">
        <span
          className={cn(
            "inline-flex size-9 shrink-0 items-center justify-center rounded-full",
            problem
              ? "bg-destructive/12 text-destructive"
              : "bg-warning/18 text-warning-foreground",
          )}
        >
          <Icon className="size-[1.125rem]" />
        </span>
        <div className="min-w-0">
          <p className="text-foreground font-semibold">{title}</p>
          <p className="text-muted-foreground mt-0.5 text-sm">{description}</p>
        </div>
      </div>
      <Button
        variant={problem ? "default" : "outline"}
        className="w-full shrink-0 sm:w-auto"
        onClick={onAction}
      >
        Reconnect
      </Button>
    </div>
  );
}
