import { Inject, Injectable } from "@nestjs/common";
import { type Database, eq } from "@spark/db";
import { truelayerAccounts } from "@spark/db/schema";
import type { SyncStatusType } from "@spark/common";
import { DATABASE_CONNECTION } from "../../modules/database";

export interface UpdateAccountStatusOptions {
  /** Stamp the successful-sync time. Omit on failures. */
  lastSyncedAt?: Date;
  /**
   * Schedule the next retry. Only written for transient `ERROR` backoffs;
   * omit for `NEEDS_REAUTH` so a terminal account is never re-queued.
   */
  nextSyncAt?: Date;
}

/**
 * Owns the single Drizzle write that mutates `truelayer_accounts.syncStatus`.
 * Extracted so the transaction and balance sync paths classify and persist
 * sync state identically instead of each duplicating the update (and so the
 * balance path, which previously never wrote status, can do so too).
 */
@Injectable()
export class TruelayerAccountStatusService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  async update(
    accountId: string,
    status: SyncStatusType,
    options: UpdateAccountStatusOptions = {},
  ): Promise<void> {
    await this.db
      .update(truelayerAccounts)
      .set({
        syncStatus: status,
        updatedAt: new Date(),
        ...(options.lastSyncedAt && { lastSyncedAt: options.lastSyncedAt }),
        ...(options.nextSyncAt && { nextSyncAt: options.nextSyncAt }),
      })
      .where(eq(truelayerAccounts.accountId, accountId));
  }
}
