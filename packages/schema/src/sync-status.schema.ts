import { z } from "zod";

export const SyncStatus = {
  OK: "OK",
  NEEDS_REAUTH: "NEEDS_REAUTH",
  ERROR: "ERROR",
} as const;

export const SyncStatusSchema = z
  .enum([SyncStatus.OK, SyncStatus.NEEDS_REAUTH, SyncStatus.ERROR])
  .meta({ id: "SyncStatus" });

export type SyncStatusType = z.infer<typeof SyncStatusSchema>;
