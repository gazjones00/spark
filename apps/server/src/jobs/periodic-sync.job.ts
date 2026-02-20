import { Inject, Injectable, Logger } from "@nestjs/common";
import { type Database, and, eq, inArray, lte, sql } from "@spark/db";
import { truelayerAccounts } from "@spark/db/schema";
import { SyncStatus } from "@spark/common";
import { DATABASE_CONNECTION } from "../modules/database";
import { Cron, Jobs, MessageQueue, Process, Processor } from "../modules/message-queue";
import type { MessageQueueService } from "../modules/message-queue";
import type { AccountSyncJobData } from "./account-sync.job";

const BATCH_SIZE = 100;
const SYNC_INTERVAL_MINUTES = 5;
/**
 * PostgreSQL advisory lock key used to prevent concurrent scheduler runs
 * across multiple server instances. Only one instance can hold this lock
 * at a time within a transaction.
 */
const SCHEDULER_LOCK_KEY = 4242001;

@Processor(MessageQueue.DEFAULT)
@Injectable()
export class PeriodicSyncJob {
  private readonly logger = new Logger(PeriodicSyncJob.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    @Inject(`QUEUE_${MessageQueue.DEFAULT}`) private readonly queue: MessageQueueService,
  ) {}

  @Cron("*/5 * * * *")
  @Process(Jobs.PeriodicSync)
  async handle(): Promise<void> {
    this.logger.log("Starting periodic transaction sync");

    const result = await this.db.transaction(async (tx) => {
      const lockResult = await tx.execute(
        sql`SELECT pg_try_advisory_xact_lock(${SCHEDULER_LOCK_KEY}) AS locked`,
      );
      const locked = Boolean(lockResult.rows?.[0]?.locked);
      if (!locked) {
        this.logger.debug("Skipping periodic sync; scheduler lock not acquired");
        return null;
      }

      const now = new Date();
      // Truncate to next sync minute boundary to align with cron schedule
      const nextSyncAt = new Date(now.getTime() + SYNC_INTERVAL_MINUTES * 60 * 1000);
      nextSyncAt.setSeconds(0, 0);

      const dueAccounts = await tx
        .select({
          accountId: truelayerAccounts.accountId,
          connectionId: truelayerAccounts.connectionId,
        })
        .from(truelayerAccounts)
        .where(
          and(
            eq(truelayerAccounts.syncStatus, SyncStatus.OK),
            lte(truelayerAccounts.nextSyncAt, now),
          ),
        )
        .orderBy(truelayerAccounts.nextSyncAt, truelayerAccounts.accountId)
        .limit(BATCH_SIZE);

      if (dueAccounts.length === 0) {
        return { accounts: [], timestamp: 0 };
      }

      await tx
        .update(truelayerAccounts)
        .set({ nextSyncAt, updatedAt: now })
        .where(
          inArray(
            truelayerAccounts.accountId,
            dueAccounts.map((a) => a.accountId),
          ),
        );

      return { accounts: dueAccounts, timestamp: now.getTime() };
    });

    // Lock wasn't acquired - another instance is handling the sync
    if (result === null) {
      return;
    }

    const { accounts, timestamp } = result;

    if (accounts.length === 0) {
      this.logger.log("No accounts due for sync");
      return;
    }

    if (accounts.length === BATCH_SIZE) {
      this.logger.warn(`Batch limit reached (${BATCH_SIZE}); some accounts may be delayed`);
    }

    const results = await Promise.allSettled(
      accounts.map((account) =>
        this.queue.add<AccountSyncJobData>(
          Jobs.AccountSync,
          {
            accountId: account.accountId,
            connectionId: account.connectionId,
          },
          {
            jobId: `account:${account.accountId}:${timestamp}`,
          },
        ),
      ),
    );

    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      this.logger.warn(`${failed.length} jobs failed to dispatch in batch`);
    }

    const totalDispatched = accounts.length - failed.length;
    this.logger.log(`Dispatched ${totalDispatched} AccountSyncJob jobs, ${failed.length} failed`);
  }
}
