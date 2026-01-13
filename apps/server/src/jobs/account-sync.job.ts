import { Injectable, Logger } from "@nestjs/common";
import { MessageQueue, Process, Processor } from "../modules/message-queue";
import { TransactionSyncService } from "./services/transaction-sync.service";

export interface AccountSyncJobData {
  accountId: string;
  connectionId: string;
}

const SYNC_DAYS = 7;

@Processor(MessageQueue.DEFAULT)
@Injectable()
export class AccountSyncJob {
  private readonly logger = new Logger(AccountSyncJob.name);

  constructor(private readonly transactionSyncService: TransactionSyncService) {}

  @Process("AccountSyncJob")
  async handle(data: AccountSyncJobData): Promise<void> {
    const { accountId, connectionId } = data;

    this.logger.log(`Syncing account ${accountId}`);

    await this.transactionSyncService.syncTransactions({
      accountId,
      connectionId,
      daysToSync: SYNC_DAYS,
    });
  }
}
