import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Database } from "@spark/db";
import { eq } from "@spark/db";
import { truelayerAccounts } from "@spark/db/schema";
import { DATABASE_CONNECTION } from "../database";

export interface UpdateAccountInput {
  id: string;
  displayName?: string;
}

@Injectable()
export class AccountsService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  async list(userId: string) {
    const accounts = await this.db.query.truelayerAccounts.findMany({
      where: eq(truelayerAccounts.userId, userId),
    });

    return {
      accounts: accounts.map((account) => ({
        id: account.id,
        accountId: account.accountId,
        accountType: account.accountType,
        displayName: account.displayName,
        currency: account.currency,
        accountNumber: account.accountNumber,
        provider: account.provider,
        updatedAt: account.updatedAt.toISOString(),
        currentBalance: account.currentBalance,
        availableBalance: account.availableBalance,
        overdraft: account.overdraft,
        balanceUpdatedAt: account.balanceUpdatedAt?.toISOString() ?? null,
        syncStatus: account.syncStatus,
        lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null,
      })),
    };
  }

  async update(userId: string, input: UpdateAccountInput) {
    const existing = await this.db.query.truelayerAccounts.findFirst({
      where: eq(truelayerAccounts.id, input.id),
    });

    if (!existing || existing.userId !== userId) {
      throw new NotFoundException("Account not found");
    }

    const updateData: Partial<typeof truelayerAccounts.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.displayName !== undefined) {
      updateData.displayName = input.displayName;
    }

    const [updated] = await this.db
      .update(truelayerAccounts)
      .set(updateData)
      .where(eq(truelayerAccounts.id, input.id))
      .returning();

    return {
      account: {
        id: updated.id,
        accountId: updated.accountId,
        accountType: updated.accountType,
        displayName: updated.displayName,
        currency: updated.currency,
        accountNumber: updated.accountNumber,
        provider: updated.provider,
        updatedAt: updated.updatedAt.toISOString(),
        currentBalance: updated.currentBalance,
        availableBalance: updated.availableBalance,
        overdraft: updated.overdraft,
        balanceUpdatedAt: updated.balanceUpdatedAt?.toISOString() ?? null,
        syncStatus: updated.syncStatus,
        lastSyncedAt: updated.lastSyncedAt?.toISOString() ?? null,
      },
    };
  }

  async delete(userId: string, id: string) {
    const existing = await this.db.query.truelayerAccounts.findFirst({
      where: eq(truelayerAccounts.id, id),
    });

    if (!existing || existing.userId !== userId) {
      throw new NotFoundException("Account not found");
    }

    await this.db.delete(truelayerAccounts).where(eq(truelayerAccounts.id, id));

    return { success: true };
  }
}
