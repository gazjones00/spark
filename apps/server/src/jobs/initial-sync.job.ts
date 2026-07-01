import { Injectable, Logger } from "@nestjs/common";
import type { z } from "zod";
import { BalanceService } from "../modules/accounts";
import { Jobs, MessageQueue, Process, Processor } from "../modules/message-queue";
import { InitialSyncJobDataSchema } from "../modules/message-queue/job-schemas";
import { TransactionSyncService } from "../modules/transactions";

export type InitialSyncJobData = z.infer<typeof InitialSyncJobDataSchema>;

export const HISTORICAL_DAYS = 90;

@Processor(MessageQueue.DEFAULT)
@Injectable()
export class InitialSyncJob {
  private readonly logger = new Logger(InitialSyncJob.name);

  constructor(
    private readonly transactionSyncService: TransactionSyncService,
    private readonly balanceService: BalanceService,
  ) {}

  @Process(Jobs.InitialSync)
  async handle(data: InitialSyncJobData): Promise<void> {
    const { accountId, connectionId, accountType } = data;

    this.logger.log(`Starting initial sync for account ${accountId}`);

    // Sync balance
    await this.balanceService.syncBalance({
      accountId,
      connectionId,
      accountType,
    });

    const count = await this.transactionSyncService.syncTransactions({
      accountId,
      connectionId,
      accountType,
      daysToSync: HISTORICAL_DAYS,
    });

    if (count > 0) {
      this.logger.log(`Initial sync completed for account ${accountId}`);
    }
  }
}
