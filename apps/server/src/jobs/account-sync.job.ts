import { Inject, Injectable, Logger } from "@nestjs/common";
import { type Database, eq } from "@spark/db";
import { truelayerAccounts } from "@spark/db/schema";
import { DATABASE_CONNECTION } from "../modules/database";
import { Jobs, MessageQueue, Process, Processor } from "../modules/message-queue";
import { BalanceSyncService } from "./services/balance-sync.service";
import { TransactionSyncService } from "./services/transaction-sync.service";

export interface AccountSyncJobData {
  accountId: string;
  connectionId: string;
}

@Processor(MessageQueue.DEFAULT)
@Injectable()
export class AccountSyncJob {
  private readonly logger = new Logger(AccountSyncJob.name);

  constructor(
    private readonly transactionSyncService: TransactionSyncService,
    private readonly balanceSyncService: BalanceSyncService,
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
  ) {}

  @Process(Jobs.AccountSync)
  async handle(data: AccountSyncJobData): Promise<void> {
    const { accountId, connectionId } = data;

    this.logger.log(`Syncing account ${accountId}`);

    const account = await this.db.query.truelayerAccounts.findFirst({
      where: eq(truelayerAccounts.accountId, accountId),
      columns: { lastSyncedAt: true },
    });

    // Sync balance and transactions in parallel
    await Promise.all([
      this.balanceSyncService.syncBalance({
        accountId,
        connectionId,
      }),
      this.transactionSyncService.syncTransactions({
        accountId,
        connectionId,
        ...(account?.lastSyncedAt
          ? { lastSyncedAt: account.lastSyncedAt }
          : {
              daysToSync: 7,
            }),
      }),
    ]);
  }
}
