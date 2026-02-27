import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Database } from "@spark/db";
import { eq } from "@spark/db";
import type { UpdateAccountInput } from "@spark/schema";
import { truelayerAccounts } from "@spark/db/schema";
import { DATABASE_CONNECTION } from "../database";
import { toAccountDto, toAccountsListDto } from "./mappers/account.mapper";

@Injectable()
export class AccountsService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  async list(userId: string) {
    const accounts = await this.db.query.truelayerAccounts.findMany({
      where: eq(truelayerAccounts.userId, userId),
    });

    return toAccountsListDto(accounts);
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

    return { account: toAccountDto(updated) };
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
