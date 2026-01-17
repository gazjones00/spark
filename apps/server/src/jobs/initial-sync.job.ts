import { Injectable, Logger } from "@nestjs/common";
import { BalanceService } from "../modules/accounts";
import { Jobs, MessageQueue, Process, Processor } from "../modules/message-queue";
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

  constructor(
    private readonly transactionSyncService: TransactionSyncService,
    private readonly balanceService: BalanceService,
  ) {}

  @Process(Jobs.InitialSync)
  async handle(data: InitialSyncJobData): Promise<void> {
    const { accountId, connectionId } = data;

    this.logger.log(`Starting initial sync for account ${accountId}`);

    // Sync balance
    await this.balanceService.syncBalance({
      accountId,
      connectionId,
    });

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
