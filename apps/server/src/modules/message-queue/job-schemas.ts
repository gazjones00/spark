import { AccountTypeSchema, ConsentExpiringEventSchema } from "@spark/schema";
import { z } from "zod";
import { Jobs } from "./constants";

/**
 * Single source of truth for queue job payload shapes.
 *
 * Job payloads cross a trust boundary: they are serialised into Redis and
 * deserialised by whatever worker build happens to be running when the job
 * is picked up. A stale job from an older deploy, a hand-edited job in Bull
 * Board, or a producer/consumer shape drift must be rejected *before* the
 * handler runs — not explode (or silently misbehave) deep inside a service.
 *
 * Producers and consumers both derive their payload types from these
 * schemas (see the `*JobData` re-exports in `src/jobs/*.job.ts`).
 */

export const AccountSyncJobDataSchema = z.strictObject({
  accountId: z.string().min(1),
  connectionId: z.string().min(1),
  accountType: AccountTypeSchema.nullish(),
});

// Same shape today; kept separate so the two can diverge safely.
export const InitialSyncJobDataSchema = AccountSyncJobDataSchema;

export const ConnectorSyncJobDataSchema = z.strictObject({
  connectionId: z.string().min(1),
  userId: z.string().min(1).optional(),
  requestedAt: z.iso.datetime().optional(),
});

// Cron-triggered jobs are enqueued with `{}` (message-queue.explorer.ts) and
// their handlers take no arguments; any payload content indicates a stale or
// tampered job, so reject it.
export const EmptyJobDataSchema = z.strictObject({});

export const JOB_SCHEMAS = {
  [Jobs.AccountSync]: AccountSyncJobDataSchema,
  [Jobs.InitialSync]: InitialSyncJobDataSchema,
  [Jobs.ConnectorSync]: ConnectorSyncJobDataSchema,
  [Jobs.ConsentExpiring]: ConsentExpiringEventSchema,
  [Jobs.ConsentLifecycleCheck]: EmptyJobDataSchema,
  [Jobs.OauthStateCleanup]: EmptyJobDataSchema,
  [Jobs.PeriodicSync]: EmptyJobDataSchema,
  [Jobs.ConnectorPeriodicSync]: EmptyJobDataSchema,
} as const satisfies Record<Jobs, z.ZodType>;
