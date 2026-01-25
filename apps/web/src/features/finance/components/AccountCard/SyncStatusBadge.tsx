import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SyncStatus } from "@spark/orpc/contract";
import { formatDistanceToNow } from "date-fns";

interface SyncStatusBadgeProps {
  status: SyncStatus;
  lastSyncedAt: string | null;
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
};

export function SyncStatusBadge({ status, lastSyncedAt }: SyncStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

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
