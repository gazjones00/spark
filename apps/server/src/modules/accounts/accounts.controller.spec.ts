import { call } from "@orpc/server";
import type { Request } from "express";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import {
  DeleteAccountResponseSchema,
  GetAccountsResponseSchema,
  UpdateAccountResponseSchema,
  type Account,
} from "@spark/schema";
import { describe, expect, it, vi } from "vitest";
import type { AccountsService } from "./accounts.service";
import { AccountsController } from "./accounts.controller";

const SESSION = { user: { id: "user-1" } } as UserSession;
const ACCOUNT_ID = "11111111-2222-4333-8444-555555555555";

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: ACCOUNT_ID,
    accountId: "acc-1",
    accountType: "TRANSACTION",
    displayName: "Everyday Account",
    currency: "GBP",
    accountNumber: { number: "12345678" },
    provider: { providerId: "mock-bank", displayName: "Mock Bank" },
    updatedAt: "2026-07-01T10:00:00.000Z",
    currentBalance: "100.50",
    availableBalance: "90.25",
    overdraft: null,
    balanceUpdatedAt: "2026-07-01T10:00:00.000Z",
    syncStatus: "OK",
    lastSyncedAt: "2026-07-01T10:00:00.000Z",
    consentStatus: "ACTIVE",
    consentExpiresAt: null,
    ...overrides,
  };
}

function createController(overrides: Partial<Record<keyof AccountsService, unknown>> = {}) {
  const service = {
    list: vi.fn().mockResolvedValue({ accounts: [makeAccount()] }),
    update: vi.fn().mockResolvedValue({ account: makeAccount() }),
    delete: vi.fn().mockResolvedValue({ success: true }),
    ...overrides,
  };
  const controller = new AccountsController(service as unknown as AccountsService);
  return { controller, service };
}

// The ORPCGlobalContext requires the express request (module augmentation in
// app.module); these in-process handler tests never read it.
const ORPC_CONTEXT = { context: { request: {} as Request } };

describe("AccountsController contract conformance", () => {
  it("list output parses against GetAccountsResponseSchema and scopes to the session user", async () => {
    const { controller, service } = createController();

    const result = await call(controller.list(SESSION), undefined, ORPC_CONTEXT);

    expect(() => GetAccountsResponseSchema.parse(result)).not.toThrow();
    expect(service.list).toHaveBeenCalledWith("user-1");
  });

  it("update output parses against UpdateAccountResponseSchema", async () => {
    const { controller, service } = createController();

    const result = await call(
      controller.update(SESSION),
      {
        id: ACCOUNT_ID,
        displayName: "Renamed",
      },
      ORPC_CONTEXT,
    );

    expect(() => UpdateAccountResponseSchema.parse(result)).not.toThrow();
    expect(service.update).toHaveBeenCalledWith("user-1", {
      id: ACCOUNT_ID,
      displayName: "Renamed",
    });
  });

  it("delete output parses against DeleteAccountResponseSchema", async () => {
    const { controller, service } = createController();

    const result = await call(controller.delete(SESSION), { id: ACCOUNT_ID }, ORPC_CONTEXT);

    expect(() => DeleteAccountResponseSchema.parse(result)).not.toThrow();
    expect(service.delete).toHaveBeenCalledWith("user-1", ACCOUNT_ID);
  });

  it("rejects a non-uuid account id before reaching the service", async () => {
    const { controller, service } = createController();

    await expect(
      call(controller.delete(SESSION), { id: "nope" }, ORPC_CONTEXT),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(service.delete).not.toHaveBeenCalled();
  });
});
