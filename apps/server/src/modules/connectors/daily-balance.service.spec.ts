import type { ConnectorSyncResult } from "@spark/connectors";
import { describe, expect, it, vi } from "vitest";
import { DailyBalanceService } from "./daily-balance.service";

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

function createService(existingRows: Array<{ accountExternalId: string; occurredAt: Date }> = []) {
  const deleteChain = { where: vi.fn().mockResolvedValue(undefined) };
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(existingRows),
  };
  const db = {
    delete: vi.fn(() => deleteChain),
    select: vi.fn(() => selectChain),
    execute: vi.fn().mockResolvedValue(undefined),
  };
  const service = new DailyBalanceService();
  return { service, db, deleteChain, selectChain };
}

describe("DailyBalanceService", () => {
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

    // Two accounts → two recompute rounds, each one delete + one insert-select.
    expect(db.delete).toHaveBeenCalledTimes(2);
    expect(db.execute).toHaveBeenCalledTimes(2);
  });

  it("recomputes from base rows in SQL (delete-then-insert-select)", async () => {
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

    expect(statements[0]).toContain("INSERT INTO account_daily_balances");
    expect(statements[0]).toContain("DISTINCT ON");
    expect(statements[0]).toContain("FROM financial_transactions");
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

  it("captures the buckets a batch's rows currently occupy", async () => {
    const { service, db } = createService([
      {
        accountExternalId: "truelayer:account:acc-1",
        occurredAt: new Date("2026-06-01T23:30:00.000Z"),
      },
      {
        accountExternalId: "truelayer:account:acc-1",
        occurredAt: new Date("2026-06-02T08:00:00.000Z"),
      },
    ]);

    const buckets = await service.captureExistingBuckets(db as never, "conn-1", [
      makeTransaction(),
    ]);

    expect(buckets.get("truelayer:account:acc-1")).toEqual(new Set(["2026-06-01", "2026-06-02"]));
  });

  it("recomputes a moved transaction's OLD day via the pre-upsert buckets", async () => {
    const { service, db } = createService();

    // The batch says the transaction now sits on 2026-06-10; before the
    // upsert it sat on 2026-06-08. Both days must be recomputed or the old
    // bucket keeps the stale contribution.
    await service.refreshForBatch(db as never, {
      userId: "user-1",
      connectionId: "conn-1",
      transactions: [makeTransaction({ occurredAt: "2026-06-10T12:00:00.000Z" })],
      previousBuckets: new Map([["truelayer:account:acc-1", new Set(["2026-06-08"])]]),
    });

    // One account → one recompute round; its day list carries both days.
    expect(db.execute).toHaveBeenCalledTimes(1);
    const balanceInsert = db.execute.mock.calls[0]?.[0] as { queryChunks?: unknown[] };
    const params = (balanceInsert.queryChunks ?? []).flatMap((chunk) =>
      typeof chunk === "object" && chunk !== null && "value" in chunk
        ? [(chunk as { value: unknown }).value]
        : [],
    );
    const dayArray = params.find(
      (value) =>
        Array.isArray(value) && value.every((entry) => /^\d{4}-\d{2}-\d{2}$/.test(String(entry))),
    ) as string[] | undefined;
    expect(dayArray).toEqual(["2026-06-08", "2026-06-10"]);
  });
});
