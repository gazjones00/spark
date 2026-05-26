import { Inject, Injectable, Logger } from "@nestjs/common";
import { type Database, eq } from "@spark/db";
import { truelayerAccounts } from "@spark/db/schema";
import type { AccountType } from "@spark/schema";
import { BalanceService } from "../modules/accounts";
import { DATABASE_CONNECTION } from "../modules/database";
import { Jobs, MessageQueue, Process, Processor } from "../modules/message-queue";
import { TransactionSyncService } from "../modules/transactions";

export interface AccountSyncJobData {
  accountId: string;
  connectionId: string;
  accountType?: AccountType | null;
}

@Processor(MessageQueue.DEFAULT)
@Injectable()
export class AccountSyncJob {
  private readonly logger = new Logger(AccountSyncJob.name);

  constructor(
    private readonly transactionSyncService: TransactionSyncService,
    private readonly balanceService: BalanceService,
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
  ) {}

  @Process(Jobs.AccountSync)
  async handle(data: AccountSyncJobData): Promise<void> {
    const { accountId, connectionId } = data;

    this.logger.log(`Syncing account ${accountId}`);

    const account = await this.db.query.truelayerAccounts.findFirst({
      where: eq(truelayerAccounts.accountId, accountId),
      columns: { accountType: true, lastSyncedAt: true },
    });
    const accountType = data.accountType ?? account?.accountType;

    // Sync balance and transactions in parallel
    await Promise.all([
      this.balanceService.syncBalance({
        accountId,
        connectionId,
        accountType,
      }),
      this.transactionSyncService.syncTransactions({
        accountId,
        connectionId,
        accountType,
        ...(account?.lastSyncedAt
          ? { lastSyncedAt: account.lastSyncedAt }
          : {
              daysToSync: 7,
            }),
      }),
    ]);
  }
}
