import { Inject, Injectable } from "@nestjs/common";
import type { Database } from "@spark/db";
import { eq } from "@spark/db";
import { notificationPreferences, userPreferences } from "@spark/db/schema";
import { DATABASE_CONNECTION } from "../database/constants";

const NOTIFICATION_DEFAULTS = {
  largeTransactions: true,
  lowBalance: true,
  budgetOverspend: true,
  syncFailures: true,
};

const USER_PREFERENCES_DEFAULTS = {
  displayCurrency: "GBP" as const,
  theme: "system" as const,
};

@Injectable()
export class SettingsService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  async getNotificationPreferences(userId: string) {
    const prefs = await this.db.query.notificationPreferences.findFirst({
      where: eq(notificationPreferences.userId, userId),
    });

    return prefs ?? { ...NOTIFICATION_DEFAULTS };
  }

  async updateNotificationPreferences(
    userId: string,
    input: Partial<{
      largeTransactions: boolean;
      lowBalance: boolean;
      budgetOverspend: boolean;
      syncFailures: boolean;
    }>,
  ) {
    const existing = await this.db.query.notificationPreferences.findFirst({
      where: eq(notificationPreferences.userId, userId),
    });

    if (existing) {
      const [updated] = await this.db
        .update(notificationPreferences)
        .set(input)
        .where(eq(notificationPreferences.userId, userId))
        .returning();
      return {
        largeTransactions: updated.largeTransactions,
        lowBalance: updated.lowBalance,
        budgetOverspend: updated.budgetOverspend,
        syncFailures: updated.syncFailures,
      };
    }

    const [inserted] = await this.db
      .insert(notificationPreferences)
      .values({ userId, ...NOTIFICATION_DEFAULTS, ...input })
      .returning();
    return {
      largeTransactions: inserted.largeTransactions,
      lowBalance: inserted.lowBalance,
      budgetOverspend: inserted.budgetOverspend,
      syncFailures: inserted.syncFailures,
    };
  }

  async getUserPreferences(userId: string) {
    const prefs = await this.db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, userId),
    });

    return prefs
      ? { displayCurrency: prefs.displayCurrency, theme: prefs.theme }
      : { ...USER_PREFERENCES_DEFAULTS };
  }

  async updateUserPreferences(
    userId: string,
    input: Partial<{ displayCurrency: string; theme: "system" | "light" | "dark" }>,
  ) {
    const existing = await this.db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, userId),
    });

    if (existing) {
      const [updated] = await this.db
        .update(userPreferences)
        .set(input)
        .where(eq(userPreferences.userId, userId))
        .returning();
      return { displayCurrency: updated.displayCurrency, theme: updated.theme };
    }

    const [inserted] = await this.db
      .insert(userPreferences)
      .values({ userId, ...USER_PREFERENCES_DEFAULTS, ...input })
      .returning();
    return { displayCurrency: inserted.displayCurrency, theme: inserted.theme };
  }
}
