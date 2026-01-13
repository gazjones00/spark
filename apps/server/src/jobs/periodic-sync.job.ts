import { Inject, Injectable, Logger } from "@nestjs/common";
import { type Database, gt } from "@spark/db";
import { truelayerAccounts } from "@spark/db/schema";
import { DATABASE_CONNECTION } from "../modules/database";
import { Cron, MessageQueue, Process, Processor } from "../modules/message-queue";
import type { MessageQueueService } from "../modules/message-queue";
import type { AccountSyncJobData } from "./account-sync.job";

const BATCH_SIZE = 100;

@Processor(MessageQueue.DEFAULT)
@Injectable()
export class PeriodicSyncJob {
  private readonly logger = new Logger(PeriodicSyncJob.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    @Inject(`QUEUE_${MessageQueue.DEFAULT}`) private readonly queue: MessageQueueService,
  ) {}

  @Cron("*/5 * * * *")
  @Process("PeriodicSyncJob")
  async handle(): Promise<void> {
    this.logger.log("Starting periodic transaction sync");

    let cursor: string | null = null;
    let totalDispatched = 0;
    let totalFailed = 0;

    while (true) {
      const accounts = await this.db
        .select({
          accountId: truelayerAccounts.accountId,
          connectionId: truelayerAccounts.connectionId,
        })
        .from(truelayerAccounts)
        .where(cursor ? gt(truelayerAccounts.accountId, cursor) : undefined)
        .orderBy(truelayerAccounts.accountId)
        .limit(BATCH_SIZE);

      if (accounts.length === 0) break;

      const results = await Promise.allSettled(
        accounts.map((account) =>
          this.queue.add<AccountSyncJobData>("AccountSyncJob", {
            accountId: account.accountId,
            connectionId: account.connectionId,
          }),
        ),
      );

      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        this.logger.warn(`${failed.length} jobs failed to dispatch in batch`);
        totalFailed += failed.length;
      }

      totalDispatched += accounts.length - failed.length;
      cursor = accounts[accounts.length - 1].accountId;

      this.logger.debug(`Dispatched batch, cursor: ${cursor}`);
    }

    this.logger.log(`Dispatched ${totalDispatched} AccountSyncJob jobs, ${totalFailed} failed`);
  }
}
