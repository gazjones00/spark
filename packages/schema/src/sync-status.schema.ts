import { z } from "zod";

export const SyncStatus = {
  OK: "OK",
  NEEDS_REAUTH: "NEEDS_REAUTH",
  ERROR: "ERROR",
  /**
   * Parked: the row has been migrated to the connector framework
   * (connector_connections/financial_*) and must not be selected by the
   * bespoke TrueLayer scheduler. See docs/adr/0001 and
   * packages/db/scripts/backfill-truelayer.ts.
   */
  MIGRATED: "MIGRATED",
} as const;

export const SyncStatusSchema = z
  .enum([SyncStatus.OK, SyncStatus.NEEDS_REAUTH, SyncStatus.ERROR, SyncStatus.MIGRATED])
  .meta({ id: "SyncStatus" });

export type SyncStatusType = z.infer<typeof SyncStatusSchema>;
