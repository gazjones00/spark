import { call } from "@orpc/server";
import type { Request } from "express";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { NotificationPreferencesSchema, UserPreferencesSchema } from "@spark/schema";
import { describe, expect, it, vi } from "vitest";
import type { SettingsService } from "./settings.service";
import { SettingsController } from "./settings.controller";

const SESSION = { user: { id: "user-1" } } as UserSession;

const NOTIFICATION_PREFERENCES = {
  largeTransactions: true,
  lowBalance: false,
  budgetOverspend: true,
  syncFailures: true,
};

const USER_PREFERENCES = { displayCurrency: "GBP", theme: "dark" as const };

function createController() {
  const service = {
    getNotificationPreferences: vi.fn().mockResolvedValue(NOTIFICATION_PREFERENCES),
    updateNotificationPreferences: vi.fn().mockResolvedValue(NOTIFICATION_PREFERENCES),
    getUserPreferences: vi.fn().mockResolvedValue(USER_PREFERENCES),
    updateUserPreferences: vi.fn().mockResolvedValue(USER_PREFERENCES),
  };
  const controller = new SettingsController(service as unknown as SettingsService);
  return { controller, service };
}

// The ORPCGlobalContext requires the express request (module augmentation in
// app.module); these in-process handler tests never read it.
const ORPC_CONTEXT = { context: { request: {} as Request } };

describe("SettingsController contract conformance", () => {
  it("getNotificationPreferences output parses against the contract schema", async () => {
    const { controller, service } = createController();

    const result = await call(
      controller.getNotificationPreferences(SESSION),
      undefined,
      ORPC_CONTEXT,
    );

    expect(() => NotificationPreferencesSchema.parse(result)).not.toThrow();
    expect(service.getNotificationPreferences).toHaveBeenCalledWith("user-1");
  });

  it("updateNotificationPreferences accepts a partial update and returns the full shape", async () => {
    const { controller, service } = createController();

    const result = await call(
      controller.updateNotificationPreferences(SESSION),
      {
        lowBalance: true,
      },
      ORPC_CONTEXT,
    );

    expect(() => NotificationPreferencesSchema.parse(result)).not.toThrow();
    expect(service.updateNotificationPreferences).toHaveBeenCalledWith("user-1", {
      lowBalance: true,
    });
  });

  it("getUserPreferences output parses against the contract schema", async () => {
    const { controller } = createController();

    const result = await call(controller.getUserPreferences(SESSION), undefined, ORPC_CONTEXT);

    expect(() => UserPreferencesSchema.parse(result)).not.toThrow();
  });

  it("updateUserPreferences rejects an unknown theme before reaching the service", async () => {
    const { controller, service } = createController();

    await expect(
      call(
        controller.updateUserPreferences(SESSION),
        { theme: "solarized" } as unknown as { theme: "dark" },
        ORPC_CONTEXT,
      ),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(service.updateUserPreferences).not.toHaveBeenCalled();
  });
});
