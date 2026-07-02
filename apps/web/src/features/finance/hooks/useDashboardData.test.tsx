// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({
  accountsList: vi.fn(),
  transactionsList: vi.fn(),
  monthlySummary: vi.fn(),
  balanceSeries: vi.fn(),
}));

vi.mock("@spark/orpc", () => ({
  orpc: {
    accounts: { list: { call: calls.accountsList } },
    transactions: {
      list: { call: calls.transactionsList },
      monthlySummary: { call: calls.monthlySummary },
      balanceSeries: { call: calls.balanceSeries },
    },
  },
}));

import { useDashboardData } from "./useDashboardData";

function makeAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: "acc-1",
    displayName: "Current Account",
    currency: "GBP",
    currentBalance: "1500",
    ...overrides,
  };
}

function renderDashboardData() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return renderHook(() => useDashboardData(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

describe("useDashboardData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calls.accountsList.mockResolvedValue({
      accounts: [makeAccount(), makeAccount({ id: "acc-2", currentBalance: "500" })],
    });
    calls.transactionsList.mockResolvedValue({
      transactions: [{ id: "txn-1" }, { id: "txn-2" }],
    });
    calls.monthlySummary.mockResolvedValue({
      totals: [
        {
          currency: "GBP",
          income: "2000",
          expenses: "750.25",
          categories: [
            { category: "PURCHASE", total: "120.50" },
            { category: "NOT_A_REAL_CATEGORY", total: "10" },
          ],
        },
        { currency: "USD", income: "99", expenses: "1", categories: [] },
      ],
    });
    calls.balanceSeries.mockResolvedValue({
      points: [
        { date: "2026-06-01", balance: "1900" },
        { date: "2026-06-02", balance: "2000.75" },
      ],
    });
  });

  it("derives dashboard figures from the four queries", async () => {
    const { result } = renderDashboardData();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.netWorth).toBe(2000);
    expect(result.current.currency).toBe("GBP");
    expect(result.current.monthlyIncome).toBe(2000);
    expect(result.current.monthlyExpenses).toBe(750.25);
    expect(result.current.hasAccounts).toBe(true);
    expect(result.current.hasTransactions).toBe(true);
    expect(result.current.recentTransactions).toHaveLength(2);
    expect(result.current.balanceSeries).toEqual([
      { date: "2026-06-01", balance: 1900 },
      { date: "2026-06-02", balance: 2000.75 },
    ]);
    expect(calls.transactionsList).toHaveBeenCalledWith({ limit: 5 });
  });

  it("picks the summary matching the dominant currency and maps category colours", async () => {
    const { result } = renderDashboardData();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const [purchase, unknown] = result.current.spendingByCategory;
    expect(purchase.category).toBe("PURCHASE");
    expect(purchase.amount).toBe(120.5);
    expect(purchase.fill).toBeTruthy();
    // Unmapped provider categories are folded into UNKNOWN so downstream
    // categoryConfig lookups (e.g. the spending chart's labels) never crash.
    expect(unknown.category).toBe("UNKNOWN");
    expect(unknown.amount).toBe(10);
    expect(unknown.fill).toBeTruthy();
  });

  it("merges multiple unmapped categories into a single UNKNOWN slice", async () => {
    calls.monthlySummary.mockResolvedValue({
      totals: [
        {
          currency: "GBP",
          income: "0",
          expenses: "30",
          categories: [
            { category: "MYSTERY_A", total: "10" },
            { category: "MYSTERY_B", total: "20" },
          ],
        },
      ],
    });

    const { result } = renderDashboardData();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.spendingByCategory).toHaveLength(1);
    expect(result.current.spendingByCategory[0].category).toBe("UNKNOWN");
    expect(result.current.spendingByCategory[0].amount).toBe(30);
  });

  it("labels fallback totals with the fallback summary's currency", async () => {
    calls.monthlySummary.mockResolvedValue({
      totals: [{ currency: "EUR", income: "300", expenses: "100", categories: [] }],
    });

    const { result } = renderDashboardData();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // No GBP rollup exists, so the EUR summary is displayed — the label must
    // follow it rather than the dominant account currency.
    expect(result.current.currency).toBe("EUR");
    expect(result.current.monthlyIncome).toBe(300);
    expect(result.current.monthlyExpenses).toBe(100);
  });

  it("returns zeroed defaults while empty and flags errors from any query", async () => {
    calls.accountsList.mockResolvedValue({ accounts: [] });
    calls.transactionsList.mockResolvedValue({ transactions: [] });
    calls.monthlySummary.mockResolvedValue({ totals: [] });
    calls.balanceSeries.mockRejectedValue(new Error("boom"));

    const { result } = renderDashboardData();

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.netWorth).toBe(0);
    expect(result.current.monthlyIncome).toBe(0);
    expect(result.current.monthlyExpenses).toBe(0);
    expect(result.current.hasAccounts).toBe(false);
    expect(result.current.hasTransactions).toBe(false);
    expect(result.current.spendingByCategory).toEqual([]);
    expect(result.current.balanceSeries).toEqual([]);
  });

  it("refetches all four queries via refetch", async () => {
    const { result } = renderDashboardData();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    result.current.refetch();

    await waitFor(() => {
      expect(calls.accountsList).toHaveBeenCalledTimes(2);
      expect(calls.transactionsList).toHaveBeenCalledTimes(2);
      expect(calls.monthlySummary).toHaveBeenCalledTimes(2);
      expect(calls.balanceSeries).toHaveBeenCalledTimes(2);
    });
  });
});
