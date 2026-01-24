import { Test, TestingModule } from "@nestjs/testing";
import { createMockDb, chainMock, type MockDb } from "@spark/testing";
import { eq } from "@spark/db";
import { notificationPreferences, userPreferences } from "@spark/db/schema";
import { SettingsService } from "./settings.service";
import { DATABASE_CONNECTION } from "../database/constants";

describe("SettingsService", () => {
  let service: SettingsService;
  let mockDb: MockDb;

  beforeEach(async () => {
    mockDb = createMockDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [SettingsService, { provide: DATABASE_CONNECTION, useValue: mockDb }],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
  });

  describe("getNotificationPreferences", () => {
    it("should return existing preferences when found", async () => {
      const existing = {
        userId: "user-1",
        largeTransactions: false,
        lowBalance: true,
        budgetOverspend: false,
        syncFailures: true,
      };
      mockDb.query.notificationPreferences.findFirst.mockResolvedValue(existing);

      const result = await service.getNotificationPreferences("user-1");

      expect(result).toEqual(existing);
    });

    it("should return defaults when no preferences exist", async () => {
      mockDb.query.notificationPreferences.findFirst.mockResolvedValue(undefined);

      const result = await service.getNotificationPreferences("user-1");

      expect(result).toEqual({
        largeTransactions: true,
        lowBalance: true,
        budgetOverspend: true,
        syncFailures: true,
      });
    });
  });

  describe("updateNotificationPreferences", () => {
    it("should update existing preferences", async () => {
      const existing = { userId: "user-1", largeTransactions: true };
      mockDb.query.notificationPreferences.findFirst.mockResolvedValue(existing);

      const updated = {
        largeTransactions: false,
        lowBalance: true,
        budgetOverspend: true,
        syncFailures: true,
      };
      const chain = chainMock(updated);
      mockDb.update.mockReturnValue(chain);

      const result = await service.updateNotificationPreferences("user-1", {
        largeTransactions: false,
      });

      expect(mockDb.update).toHaveBeenCalled();
      expect(chain.set).toHaveBeenCalledWith({ largeTransactions: false });
      expect(chain.where).toHaveBeenCalledWith(eq(notificationPreferences.userId, "user-1"));
      expect(result).toEqual(updated);
    });

    it("should insert new preferences with defaults when none exist", async () => {
      mockDb.query.notificationPreferences.findFirst.mockResolvedValue(undefined);

      const inserted = {
        largeTransactions: true,
        lowBalance: false,
        budgetOverspend: true,
        syncFailures: true,
      };
      const chain = chainMock(inserted);
      mockDb.insert.mockReturnValue(chain);

      const result = await service.updateNotificationPreferences("user-1", {
        lowBalance: false,
      });

      expect(mockDb.insert).toHaveBeenCalled();
      expect(chain.values).toHaveBeenCalledWith({
        userId: "user-1",
        largeTransactions: true,
        lowBalance: false,
        budgetOverspend: true,
        syncFailures: true,
      });
      expect(result).toEqual(inserted);
    });
  });

  describe("getUserPreferences", () => {
    it("should return existing preferences when found", async () => {
      const existing = {
        userId: "user-1",
        displayCurrency: "USD",
        theme: "dark",
      };
      mockDb.query.userPreferences.findFirst.mockResolvedValue(existing);

      const result = await service.getUserPreferences("user-1");

      expect(result).toEqual({ displayCurrency: "USD", theme: "dark" });
    });

    it("should return defaults when no preferences exist", async () => {
      mockDb.query.userPreferences.findFirst.mockResolvedValue(undefined);

      const result = await service.getUserPreferences("user-1");

      expect(result).toEqual({ displayCurrency: "GBP", theme: "system" });
    });
  });

  describe("updateUserPreferences", () => {
    it("should update existing preferences", async () => {
      const existing = { userId: "user-1", displayCurrency: "GBP", theme: "system" };
      mockDb.query.userPreferences.findFirst.mockResolvedValue(existing);

      const updated = { displayCurrency: "EUR", theme: "system" };
      const chain = chainMock(updated);
      mockDb.update.mockReturnValue(chain);

      const result = await service.updateUserPreferences("user-1", {
        displayCurrency: "EUR",
      });

      expect(mockDb.update).toHaveBeenCalled();
      expect(chain.set).toHaveBeenCalledWith({ displayCurrency: "EUR" });
      expect(chain.where).toHaveBeenCalledWith(eq(userPreferences.userId, "user-1"));
      expect(result).toEqual({ displayCurrency: "EUR", theme: "system" });
    });

    it("should insert new preferences with defaults when none exist", async () => {
      mockDb.query.userPreferences.findFirst.mockResolvedValue(undefined);

      const inserted = { displayCurrency: "GBP", theme: "dark" };
      const chain = chainMock(inserted);
      mockDb.insert.mockReturnValue(chain);

      const result = await service.updateUserPreferences("user-1", {
        theme: "dark",
      });

      expect(mockDb.insert).toHaveBeenCalled();
      expect(chain.values).toHaveBeenCalledWith({
        userId: "user-1",
        displayCurrency: "GBP",
        theme: "dark",
      });
      expect(result).toEqual({ displayCurrency: "GBP", theme: "dark" });
    });
  });
});
