import { z } from "zod";
import { enumValues } from "../utils/enum-values.ts";

export const SyncStatus = {
  OK: "OK",
  NEEDS_REAUTH: "NEEDS_REAUTH",
  ERROR: "ERROR",
} as const;

export const SyncStatusSchema = z.enum(enumValues(SyncStatus));

export type SyncStatusType = z.infer<typeof SyncStatusSchema>;
