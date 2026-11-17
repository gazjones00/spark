import { describe, expect, it, vi } from "vitest";
import { TransactionsService } from "./transactions.service";

interface AggregateFixture {
  totals?: Array<{ currency: string; income: string; expenses: string; transactionCount: number }>;
  categories?: Array<{
    currency: string;
    category: string;
    total: string;
    transactionCount: number;
  }>;
}

function createService(fixture: AggregateFixture = {}) {
  // The grouped-aggregate chains resolve at their terminal builder methods;
  // resolution order matches the service's query order.
  const groupedResults = [fixture.totals ?? [], fixture.categories ?? []];
  let groupedCall = 0;
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    having: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockImplementation(() => {
      const result = groupedResults[groupedCall] ?? [];
      groupedCall += 1;
      return Promise.resolve(result);
    }),
  };
  const db = {
    select: vi.fn(() => selectChain),
  };

  const service = new TransactionsService(db as never);
  return { service, db, selectChain };
}

describe("TransactionsService.monthlySummary", () => {
  it("returns per-currency totals with their spending categories attached", async () => {
    const { service } = createService({
      totals: [
        { currency: "GBP", income: "1200.50", expenses: "830.25", transactionCount: 140 },
        { currency: "USD", income: "10.00", expenses: "5.00", transactionCount: 3 },
      ],
      // Category spend is keyed by the enriched reference: a built-in value
      // or a custom category id.
      categories: [
        { currency: "GBP", category: "SHOPPING", total: "600.25", transactionCount: 90 },
        { currency: "GBP", category: "cat-coffee", total: "230.00", transactionCount: 12 },
        { currency: "USD", category: "SHOPPING", total: "5.00", transactionCount: 2 },
      ],
    });

    const result = await service.monthlySummary("user-1", { month: "2026-06" });

    expect(result.month).toBe("2026-06");
    expect(result.totals).toEqual([
      {
        currency: "GBP",
        income: "1200.50",
        expenses: "830.25",
        transactionCount: 140,
        categories: [
          { category: "SHOPPING", total: "600.25", transactionCount: 90 },
          { category: "cat-coffee", total: "230.00", transactionCount: 12 },
        ],
      },
      {
        currency: "USD",
        income: "10.00",
        expenses: "5.00",
        transactionCount: 3,
        categories: [{ category: "SHOPPING", total: "5.00", transactionCount: 2 }],
      },
    ]);
  });

  it("defaults to the current UTC month and returns no totals for an empty month", async () => {
    const { service } = createService();

    const result = await service.monthlySummary("user-1");

    expect(result.month).toBe(new Date().toISOString().slice(0, 7));
    expect(result.totals).toEqual([]);
  });
});

describe("TransactionsService.balanceSeries", () => {
  function createSeriesService(
    anchors: Array<Record<string, string>>,
    movements: Array<Record<string, string>>,
    laterOnAnchorDay: Array<Record<string, string>> = [],
  ) {
    const anchorChain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue(anchors),
    };
    const movementChain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockResolvedValue(movements),
    };
    const laterChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockResolvedValue(laterOnAnchorDay),
    };
    const db = {
      selectDistinctOn: vi.fn(() => anchorChain),
      select: vi.fn().mockReturnValueOnce(movementChain).mockReturnValueOnce(laterChain),
    };
    return { service: new TransactionsService(db as never), db };
  }

  it("rebuilds net worth for every day of the window from balances and transactions", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { service } = createSeriesService(
      [
        {
          connectionId: "conn-1",
          accountExternalId: "current",
          balance: "500.0000",
          observedDay: today,
          type: "CASH",
          currency: "GBP",
        },
        {
          connectionId: "conn-2",
          accountExternalId: "card",
          balance: "120.0000",
          observedDay: today,
          type: "CARD",
          currency: "GBP",
        },
      ],
      [{ connectionId: "conn-2", accountExternalId: "card", day: today, amount: "20.0000" }],
    );

    const result = await service.balanceSeries("user-1", { days: 7 });

    expect(result.points).toHaveLength(7);
    expect(result.points.at(-1)).toEqual({ date: today, balance: "380.00", currency: "GBP" });
    // Before today's card purchase the card owed 100.
    expect(result.points.at(-2)?.balance).toBe("400.00");
  });

  it("applies transactions made after a mid-day balance snapshot", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { service } = createSeriesService(
      [
        {
          connectionId: "conn-1",
          accountExternalId: "current",
          balance: "100.0000",
          observedAt: `${today}T09:00:00.000Z`,
          observedDay: today,
          type: "CASH",
          currency: "GBP",
        },
      ],
      [{ connectionId: "conn-1", accountExternalId: "current", day: today, amount: "-20.0000" }],
      // The -20 happened at noon, after the 09:00 snapshot of 100.
      [{ connectionId: "conn-1", accountExternalId: "current", amount: "-20.0000" }],
    );

    const result = await service.balanceSeries("user-1", { days: 2 });

    expect(result.points.map((point) => point.balance)).toEqual(["100.00", "80.00"]);
  });

  it("returns an empty series without querying transactions when no balance was observed", async () => {
    const { service, db } = createSeriesService([], []);

    await expect(service.balanceSeries("user-1")).resolves.toEqual({ points: [] });
    expect(db.select).not.toHaveBeenCalled();
  });
});
