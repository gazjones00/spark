import { Injectable, Logger } from "@nestjs/common";
import { MessageQueue, Process, Processor } from "../modules/message-queue";
import { TransactionSyncService } from "./services/transaction-sync.service";

export interface InitialSyncJobData {
  accountId: string;
  connectionId: string;
}

const HISTORICAL_DAYS = 90;

@Processor(MessageQueue.DEFAULT)
@Injectable()
export class InitialSyncJob {
  private readonly logger = new Logger(InitialSyncJob.name);

  constructor(private readonly transactionSyncService: TransactionSyncService) {}

  @Process("InitialSyncJob")
  async handle(data: InitialSyncJobData): Promise<void> {
    const { accountId, connectionId } = data;

    this.logger.log(`Starting initial sync for account ${accountId}`);

    const count = await this.transactionSyncService.syncTransactions({
      accountId,
      connectionId,
      daysToSync: HISTORICAL_DAYS,
    });

    if (count > 0) {
      this.logger.log(`Initial sync completed for account ${accountId}`);
    }
  }
}
