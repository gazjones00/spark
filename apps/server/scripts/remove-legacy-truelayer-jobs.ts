/**
 * One-off queue cleanup after the legacy TrueLayer sync stack was removed.
 *
 * Its cron scheduler lives in Redis, not in code: without this, the stored
 * `periodic-sync` scheduler keeps enqueuing PeriodicSync jobs that no worker
 * handles. Also removes any leftover PeriodicSync/AccountSync/InitialSync
 * jobs (queued, history, or parked in the dead-letter queue). A job a worker
 * is running right now is reported and left alone. Safe to re-run.
 *
 *   bun run queue:remove-legacy-truelayer-jobs           # dry run: report only
 *   bun run queue:remove-legacy-truelayer-jobs --apply   # delete
 */
import { env } from "@spark/env/server";
import { type JobType, Queue } from "bullmq";
import { MessageQueue } from "../src/modules/message-queue/constants";

const LEGACY_SCHEDULER_ID = "periodic-sync";
const LEGACY_JOB_NAMES = new Set(["PeriodicSync", "AccountSync", "InitialSync"]);
const REMOVABLE_STATES: JobType[] = [
  "waiting",
  "delayed",
  "prioritized",
  "paused",
  "waiting-children",
  "completed",
  "failed",
];

const apply = process.argv.includes("--apply");
const connection = { host: env.REDIS_HOST, port: env.REDIS_PORT };

async function sweep(queueName: MessageQueue, withScheduler: boolean): Promise<void> {
  const queue = new Queue(queueName, { connection });
  try {
    const scheduler = withScheduler ? await queue.getJobScheduler(LEGACY_SCHEDULER_ID) : undefined;
    const isLegacy = (job: { name: string } | undefined) =>
      job !== undefined && LEGACY_JOB_NAMES.has(job.name);
    const removable = (await queue.getJobs(REMOVABLE_STATES)).filter(isLegacy);
    const active = (await queue.getJobs(["active"])).filter(isLegacy);

    if (withScheduler) {
      console.log(
        `${queueName}: scheduler "${LEGACY_SCHEDULER_ID}" ${scheduler ? "present" : "absent"}`,
      );
    }
    const counts = new Map<string, number>();
    for (const job of removable) {
      counts.set(job.name, (counts.get(job.name) ?? 0) + 1);
    }
    console.log(
      `${queueName}: ${removable.length} legacy job(s) removable`,
      Object.fromEntries(counts),
    );
    if (active.length > 0) {
      console.log(`${queueName}: ${active.length} legacy job(s) active, left to finish`);
    }

    if (!apply) {
      return;
    }
    if (scheduler) {
      await queue.removeJobScheduler(LEGACY_SCHEDULER_ID);
    }
    for (const job of removable) {
      await job.remove();
    }
    console.log(
      `${queueName}: removed ${scheduler ? "scheduler and " : ""}${removable.length} job(s)`,
    );
  } finally {
    await queue.close();
  }
}

async function main(): Promise<void> {
  console.log(apply ? "Applying cleanup" : "Dry run (pass --apply to delete)");
  await sweep(MessageQueue.DEFAULT, true);
  await sweep(MessageQueue.DEAD_LETTER, false);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
