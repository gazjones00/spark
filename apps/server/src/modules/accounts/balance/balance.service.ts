import { Inject, Injectable, Logger } from "@nestjs/common";
import { type Database, eq } from "@spark/db";
import { truelayerAccounts } from "@spark/db/schema";
import type { AccountType } from "@spark/schema";
import {
  TruelayerClient,
  TruelayerConnectionService,
  TruelayerAccountStatusService,
} from "../../../providers/truelayer";
import { syncErrorBackoff } from "../../../providers/truelayer/sync-error-backoff";
import { DATABASE_CONNECTION } from "../../database";

export interface SyncBalanceParams {
  accountId: string;
  connectionId: string;
  accountType?: AccountType | null;
}

@Injectable()
export class BalanceService {
  private readonly logger = new Logger(BalanceService.name);

  constructor(
    private readonly truelayerClient: TruelayerClient,
    private readonly connectionService: TruelayerConnectionService,
    private readonly statusService: TruelayerAccountStatusService,
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
        accountType: params.accountType,
      });

      const now = new Date();
      const balanceTimestamp = balance.updateTimestamp ? new Date(balance.updateTimestamp) : now;

      await this.db
        .update(truelayerAccounts)
        .set({
          currentBalance: balance.current,
          availableBalance: balance.available ?? null,
          overdraft: balance.overdraft ?? null,
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
      // Balance runs in parallel with transaction sync; previously a
      // revoked-consent 401 here was re-thrown without ever recording status,
      // so an account could miss the NEEDS_REAUTH flip if balance rejected
      // alone. Classify and persist here too (last write wins, harmlessly).
      const backoff = syncErrorBackoff(error);
      if (backoff.rateLimitRetryAfterMs !== undefined) {
        this.logger.warn({
          event: "provider.ratelimit.hit",
          providerId: "truelayer",
          connectionId,
          accountId,
          retryAfterMs: backoff.rateLimitRetryAfterMs,
          backoffMs: backoff.backoffMs,
        });
      }
      await this.statusService.update(accountId, backoff.status, {
        nextSyncAt: backoff.nextSyncAt,
      });
      throw error;
    }
  }
}
