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
  balances?: Array<{ day: string; balance: string; currency: string }>;
  transactionDays?: Array<{ day: string }>;
}

function createService(fixture: AggregateFixture = {}) {
  // The grouped-aggregate chains resolve at their terminal builder methods;
  // resolution order matches the service's query order.
  const groupedResults = [fixture.totals ?? [], fixture.categories ?? []];
  let groupedCall = 0;
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
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
  const distinctOnChain = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue(fixture.balances ?? []),
  };
  const distinctChain = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue(fixture.transactionDays ?? []),
  };
  const db = {
    select: vi.fn(() => selectChain),
    selectDistinctOn: vi.fn(() => distinctOnChain),
    selectDistinct: vi.fn(() => distinctChain),
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
      categories: [
        { currency: "GBP", category: "PURCHASE", total: "600.25", transactionCount: 90 },
        { currency: "GBP", category: "DIRECT_DEBIT", total: "230.00", transactionCount: 12 },
        { currency: "USD", category: "PURCHASE", total: "5.00", transactionCount: 2 },
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
          { category: "PURCHASE", total: "600.25", transactionCount: 90 },
          { category: "DIRECT_DEBIT", total: "230.00", transactionCount: 12 },
        ],
      },
      {
        currency: "USD",
        income: "10.00",
        expenses: "5.00",
        transactionCount: 3,
        categories: [{ category: "PURCHASE", total: "5.00", transactionCount: 2 }],
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
  it("carries the last observed balance forward across days without one", async () => {
    const { service } = createService({
      balances: [
        { day: "2026-06-01", balance: "150.0000", currency: "GBP" },
        { day: "2026-06-03", balance: "200.0000", currency: "GBP" },
      ],
      // 2026-06-02 had transactions but none carried a running balance.
      transactionDays: [{ day: "2026-06-01" }, { day: "2026-06-02" }, { day: "2026-06-03" }],
    });

    const result = await service.balanceSeries("user-1", { days: 90 });

    expect(result.points).toEqual([
      { date: "2026-06-01", balance: "150.0000", currency: "GBP" },
      { date: "2026-06-02", balance: "150.0000", currency: "GBP" },
      { date: "2026-06-03", balance: "200.0000", currency: "GBP" },
    ]);
  });

  it("emits nothing for days before the first observed balance", async () => {
    const { service } = createService({
      balances: [{ day: "2026-06-05", balance: "80.0000", currency: "GBP" }],
      transactionDays: [{ day: "2026-06-02" }, { day: "2026-06-05" }],
    });

    const result = await service.balanceSeries("user-1");

    expect(result.points).toEqual([{ date: "2026-06-05", balance: "80.0000", currency: "GBP" }]);
  });

  it("returns an empty series when no balances were ever observed", async () => {
    const { service } = createService({
      transactionDays: [{ day: "2026-06-02" }],
    });

    const result = await service.balanceSeries("user-1");

    expect(result.points).toEqual([]);
  });
});
