// TODO: Move to accounts module

import { Inject, Injectable, Logger } from "@nestjs/common";
import { type Database, eq } from "@spark/db";
import { truelayerAccounts } from "@spark/db/schema";
import { TruelayerClient, TruelayerConnectionService } from "../../providers/truelayer";
import { DATABASE_CONNECTION } from "../../modules/database";

export interface SyncBalanceParams {
  accountId: string;
  connectionId: string;
}

@Injectable()
export class BalanceSyncService {
  private readonly logger = new Logger(BalanceSyncService.name);

  constructor(
    private readonly truelayerClient: TruelayerClient,
    private readonly connectionService: TruelayerConnectionService,
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
  ) {}

  async syncBalance(params: SyncBalanceParams): Promise<void> {
    const { accountId, connectionId } = params;

    try {
      const accessToken = await this.connectionService.getAccessToken(connectionId);

      this.logger.log(`Fetching balance for account ${accountId}`);

      const balance = await this.truelayerClient.getBalance({
        accessToken,
        accountId,
      });

      const now = new Date();
      const balanceTimestamp = balance.updateTimestamp ? new Date(balance.updateTimestamp) : now;

      await this.db
        .update(truelayerAccounts)
        .set({
          currentBalance: balance.current.toString(),
          availableBalance: balance.available?.toString() ?? null,
          overdraft: balance.overdraft?.toString() ?? null,
          balanceUpdatedAt: balanceTimestamp,
          updatedAt: now,
        })
        .where(eq(truelayerAccounts.accountId, accountId));

      this.logger.log(
        `Updated balance for account ${accountId}: current=${balance.current}, available=${balance.available ?? "N/A"}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to sync balance for account ${accountId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
