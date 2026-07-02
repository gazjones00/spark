// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import type { Account } from "@spark/orpc/contract";

const listAccounts = vi.hoisted(() => vi.fn());

vi.mock("@spark/orpc", () => ({
  orpc: {
    accounts: {
      list: { call: listAccounts },
      update: { call: vi.fn() },
      delete: { call: vi.fn() },
    },
    truelayer: { generateAuthLink: { call: vi.fn() } },
  },
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement("a", props as React.HTMLAttributes<HTMLAnchorElement>, children),
  useNavigate: () => () => {},
  useSearch: () => ({}),
  useLocation: () => ({ pathname: "/" }),
}));

import { Route } from "./accounts";

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "11111111-2222-4333-8444-555555555555",
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
    ...overrides,
  };
}

function renderAccounts() {
  const AccountsPage = Route.options.component!;
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <React.Suspense fallback={<div>loading…</div>}>
        <AccountsPage />
      </React.Suspense>
    </QueryClientProvider>,
  );
}

describe("accounts route", () => {
  it("renders the connected accounts returned by the API", async () => {
    listAccounts.mockResolvedValue({ accounts: [makeAccount()] });

    renderAccounts();

    expect(await screen.findByText("Everyday Account")).toBeDefined();
    expect(screen.getByText("Accounts")).toBeDefined();
  });

  it("renders every account in the list", async () => {
    listAccounts.mockResolvedValue({
      accounts: [
        makeAccount(),
        makeAccount({
          id: "22222222-3333-4444-8555-666666666666",
          accountId: "acc-2",
          displayName: "Rainy Day Savings",
          accountType: "SAVINGS",
        }),
      ],
    });

    renderAccounts();

    expect(await screen.findByText("Everyday Account")).toBeDefined();
    expect(screen.getByText("Rainy Day Savings")).toBeDefined();
  });
});
