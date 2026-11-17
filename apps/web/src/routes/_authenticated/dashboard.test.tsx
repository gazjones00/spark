// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardData } from "@/features/finance/hooks/useDashboardData";

const dashboardData = vi.hoisted(() => ({ current: {} as DashboardData }));

vi.mock("@spark/auth/react", () => ({
  useAuth: () => ({ user: { name: "Test User" } }),
}));

vi.mock("@spark/orpc", () => ({
  orpc: {
    truelayer: { generateAuthLink: { call: vi.fn() } },
    connectors: { list: { call: vi.fn().mockResolvedValue({ connectors: [] }) } },
  },
}));

vi.mock("@/features/finance/hooks/useDashboardData", () => ({
  useDashboardData: () => dashboardData.current,
}));

// Link needs a RouterProvider; a plain anchor keeps these smoke tests
// router-free without touching the rest of the module.
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement("a", props as React.HTMLAttributes<HTMLAnchorElement>, children),
  useNavigate: () => () => {},
  useSearch: () => ({}),
  useLocation: () => ({ pathname: "/" }),
}));

import { Route } from "./dashboard";

function makeDashboardData(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    accounts: [],
    netWorth: 1234.56,
    previousMonth: null,
    monthlyIncome: 2000,
    monthlyExpenses: 750,
    currency: "GBP",
    balanceSeries: [],
    spendingByCategory: [],
    recentTransactions: [],
    hasAccounts: true,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  } as DashboardData;
}

function renderDashboard() {
  const DashboardPage = Route.options.component!;
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <DashboardPage />
    </QueryClientProvider>,
  );
}

describe("dashboard route", () => {
  beforeEach(() => {
    dashboardData.current = makeDashboardData();
  });

  it("greets the user by first name and shows the headline figures", () => {
    renderDashboard();

    expect(
      screen.getByRole("heading", { name: /^Good (morning|afternoon|evening), Test$/ }),
    ).toBeDefined();
    expect(screen.getByText("Net worth")).toBeDefined();
    expect(screen.getByText("£1,234.56")).toBeDefined();
    expect(screen.getByText("Money in")).toBeDefined();
    expect(screen.getByText("Spending by category")).toBeDefined();
  });

  it("welcomes a new user and walks them through connecting an account", () => {
    dashboardData.current = makeDashboardData({ hasAccounts: false });

    renderDashboard();

    expect(screen.getByRole("heading", { name: "Welcome to Spark, Test" })).toBeDefined();
    expect(screen.getByText("Let's connect your first account")).toBeDefined();
    expect(screen.getByText("Read-only, by design")).toBeDefined();
  });

  it("renders the error state with a retry affordance", () => {
    dashboardData.current = makeDashboardData({ isError: true });

    renderDashboard();

    expect(screen.getByText("Couldn't load your dashboard")).toBeDefined();
    expect(screen.getByRole("button", { name: /try again/i })).toBeDefined();
  });

  it("renders skeletons while loading (no data, no empty state)", () => {
    dashboardData.current = makeDashboardData({ isLoading: true });

    renderDashboard();

    expect(screen.queryByText("Let's connect your first account")).toBeNull();
    expect(screen.queryByText("Net worth")).toBeNull();
  });
});
