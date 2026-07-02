import type { ConnectorSyncResult } from "@spark/connectors";
import { describe, expect, it, vi } from "vitest";
import { TransactionRollupService } from "./transaction-rollup.service";

function makeTransaction(
  overrides: Partial<ConnectorSyncResult["transactions"][number]> = {},
): ConnectorSyncResult["transactions"][number] {
  return {
    providerId: "truelayer",
    externalId: "truelayer:txn:txn-1",
    accountExternalId: "truelayer:account:acc-1",
    type: "PAYMENT",
    status: "SETTLED",
    occurredAt: "2026-06-10T12:00:00.000Z",
    description: "Coffee",
    amount: "3.50",
    currency: "GBP",
    metadata: {},
    ...overrides,
  } as ConnectorSyncResult["transactions"][number];
}

function createService() {
  const deleteChain = { where: vi.fn().mockResolvedValue(undefined) };
  const db = {
    delete: vi.fn(() => deleteChain),
    execute: vi.fn().mockResolvedValue(undefined),
  };
  const service = new TransactionRollupService();
  return { service, db, deleteChain };
}

describe("TransactionRollupService", () => {
  it("recomputes one bucket set per touched account", async () => {
    const { service, db } = createService();

    await service.refreshForBatch(db as never, {
      userId: "user-1",
      connectionId: "conn-1",
      transactions: [
        makeTransaction({ accountExternalId: "truelayer:account:acc-1" }),
        makeTransaction({
          accountExternalId: "truelayer:account:acc-1",
          occurredAt: "2026-06-11T09:00:00.000Z",
        }),
        makeTransaction({ accountExternalId: "truelayer:account:acc-2" }),
      ],
    });

    // Two accounts → two recompute rounds, each doing two deletes (rollups +
    // balances) and two insert-selects.
    expect(db.delete).toHaveBeenCalledTimes(4);
    expect(db.execute).toHaveBeenCalledTimes(4);
  });

  it("recomputes from base rows in SQL (delete-then-insert-select, grouped)", async () => {
    const { service, db } = createService();

    await service.refreshForBatch(db as never, {
      userId: "user-1",
      connectionId: "conn-1",
      transactions: [makeTransaction()],
    });

    const statements = db.execute.mock.calls.map((call) =>
      (call[0] as { queryChunks?: unknown[] }).queryChunks
        ?.map((chunk) =>
          typeof chunk === "object" && chunk !== null && "value" in chunk
            ? String((chunk as { value: unknown }).value)
            : "",
        )
        .join(""),
    );

    expect(statements[0]).toContain("INSERT INTO transaction_daily_rollups");
    expect(statements[0]).toContain("GROUP BY");
    expect(statements[0]).toContain("FROM financial_transactions");
    expect(statements[1]).toContain("INSERT INTO account_daily_balances");
    expect(statements[1]).toContain("DISTINCT ON");
  });

  it("does nothing for a batch with no transactions", async () => {
    const { service, db } = createService();

    await service.refreshForBatch(db as never, {
      userId: "user-1",
      connectionId: "conn-1",
      transactions: [],
    });

    expect(db.delete).not.toHaveBeenCalled();
    expect(db.execute).not.toHaveBeenCalled();
  });

  it("skips transactions whose timestamp does not parse", async () => {
    const { service, db } = createService();

    await service.refreshForBatch(db as never, {
      userId: "user-1",
      connectionId: "conn-1",
      transactions: [makeTransaction({ occurredAt: "not-a-date" })],
    });

    expect(db.delete).not.toHaveBeenCalled();
  });
});
