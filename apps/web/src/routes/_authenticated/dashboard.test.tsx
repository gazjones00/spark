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
    netWorth: 1234.56,
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

  it("renders the page header and stats for loaded data", () => {
    renderDashboard();

    expect(screen.getByText("Dashboard")).toBeDefined();
    expect(screen.getByText(/Welcome back, Test User/)).toBeDefined();
    expect(screen.getByText(/net worth/i)).toBeDefined();
  });

  it("renders the empty state when no accounts are connected", () => {
    dashboardData.current = makeDashboardData({ hasAccounts: false });

    renderDashboard();

    expect(screen.getByText("No accounts connected yet")).toBeDefined();
  });

  it("renders the error state with a retry affordance", () => {
    dashboardData.current = makeDashboardData({ isError: true });

    renderDashboard();

    expect(screen.getByText("Couldn't load your dashboard")).toBeDefined();
    expect(screen.getByRole("button", { name: /retry/i })).toBeDefined();
  });

  it("renders skeletons while loading (no data, no empty state)", () => {
    dashboardData.current = makeDashboardData({ isLoading: true });

    renderDashboard();

    expect(screen.queryByText("No accounts connected yet")).toBeNull();
    expect(screen.queryByText(/net worth/i)).toBeNull();
  });
});
