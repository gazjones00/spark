import { call } from "@orpc/server";
import type { Request } from "express";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { ListTransactionsResponseSchema, type SavedTransaction } from "@spark/schema";
import { describe, expect, it, vi } from "vitest";
import type { TransactionsService } from "./transactions.service";
import { TransactionsController } from "./transactions.controller";

const SESSION = { user: { id: "user-1" } } as UserSession;

function makeTransaction(): SavedTransaction {
  return {
    id: "11111111-2222-4333-8444-555555555555",
    transactionId: "txn-1",
    accountId: "acc-1",
    normalisedProviderTransactionId: null,
    providerTransactionId: null,
    timestamp: "2026-06-29T10:00:00.000Z",
    description: "Coffee",
    amount: "-3.50",
    currency: "GBP",
    transactionType: "DEBIT",
    transactionCategory: "PURCHASE",
    transactionClassification: [],
    merchantName: null,
    runningBalance: null,
    meta: null,
    updatedAt: "2026-06-29T10:00:00.000Z",
  };
}

function createController() {
  const service = {
    list: vi.fn().mockResolvedValue({
      transactions: [makeTransaction()],
      nextCursor: null,
      hasMore: false,
    }),
  };
  const controller = new TransactionsController(service as unknown as TransactionsService);
  return { controller, service };
}

// The ORPCGlobalContext requires the express request (module augmentation in
// app.module); these in-process handler tests never read it.
const ORPC_CONTEXT = { context: { request: {} as Request } };

describe("TransactionsController contract conformance", () => {
  it("list output parses against ListTransactionsResponseSchema", async () => {
    const { controller, service } = createController();

    const result = await call(controller.list(SESSION), { limit: 25 }, ORPC_CONTEXT);

    expect(() => ListTransactionsResponseSchema.parse(result)).not.toThrow();
    expect(service.list).toHaveBeenCalledWith("user-1", expect.objectContaining({ limit: 25 }));
  });

  it("rejects an out-of-range page size before reaching the service", async () => {
    const { controller, service } = createController();

    await expect(
      call(controller.list(SESSION), { limit: 500 }, ORPC_CONTEXT),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(service.list).not.toHaveBeenCalled();
  });

  it("rejects a blank search term (input trust boundary)", async () => {
    const { controller, service } = createController();

    await expect(
      call(controller.list(SESSION), { search: "   " }, ORPC_CONTEXT),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(service.list).not.toHaveBeenCalled();
  });
});
