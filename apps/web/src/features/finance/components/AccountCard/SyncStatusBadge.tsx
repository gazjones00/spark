import { CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SyncStatusType } from "@spark/common";
import type { ConsentStatusType } from "@spark/orpc/contract";
import { formatDistanceToNow } from "date-fns";

interface SyncStatusBadgeProps {
  status: SyncStatusType;
  lastSyncedAt: string | null;
  consentStatus?: ConsentStatusType;
}

const statusConfig = {
  OK: {
    icon: CheckCircle2,
    label: "Synced",
    variant: "secondary" as const,
  },
  NEEDS_REAUTH: {
    icon: AlertTriangle,
    label: "Reconnect required",
    variant: "destructive" as const,
  },
  ERROR: {
    icon: XCircle,
    label: "Sync error",
    variant: "destructive" as const,
  },
  // Internal parking state for backfilled bespoke rows (docs/adr/0001);
  // never served by the accounts read path, but the record is exhaustive.
  MIGRATED: {
    icon: CheckCircle2,
    label: "Migrated",
    variant: "secondary" as const,
  },
} satisfies Record<
  SyncStatusType,
  { icon: typeof CheckCircle2; label: string; variant: "secondary" | "destructive" }
>;

export function SyncStatusBadge({ status, lastSyncedAt, consentStatus }: SyncStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  // Proactive, non-destructive prompt: consent is estimated to lapse soon but
  // syncing still works — softer than the destructive NEEDS_REAUTH badge.
  if (status === "OK" && consentStatus === "EXPIRING_SOON") {
    return (
      <Badge
        variant="outline"
        className="gap-1 text-xs leading-[16px] h-6 border-amber-500/50 text-amber-600 dark:text-amber-400"
      >
        <Clock className="size-3" />
        Reconnect soon
      </Badge>
    );
  }

  if (status === "OK") {
    const syncTime = lastSyncedAt
      ? formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true })
      : "Never";

    return (
      <span className="text-muted-foreground text-xs flex items-center gap-1">
        <Icon className="size-3" />
        Synced {syncTime}
      </span>
    );
  }

  return (
    <Badge variant={config.variant} className="gap-1 text-xs leading-[16px] h-6">
      <Icon className="size-3" />
      {config.label}
    </Badge>
  );
}
