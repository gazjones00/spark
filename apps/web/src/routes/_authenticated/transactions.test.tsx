// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import type { SavedTransaction } from "@spark/orpc/contract";

const listAccounts = vi.hoisted(() => vi.fn());
const listTransactions = vi.hoisted(() => vi.fn());

vi.mock("@spark/orpc", () => ({
  orpc: {
    accounts: { list: { call: listAccounts } },
    transactions: { list: { call: listTransactions } },
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

import { Route } from "./transactions";

function makeTransaction(overrides: Partial<SavedTransaction> = {}): SavedTransaction {
  return {
    id: "11111111-2222-4333-8444-555555555555",
    transactionId: "txn-1",
    accountId: "acc-1",
    normalisedProviderTransactionId: null,
    providerTransactionId: null,
    timestamp: "2026-06-29T10:00:00.000Z",
    description: "Coffee Shop",
    amount: "-3.50",
    currency: "GBP",
    transactionType: "DEBIT",
    transactionCategory: "PURCHASE",
    transactionClassification: [],
    merchantName: null,
    runningBalance: null,
    meta: null,
    updatedAt: "2026-06-29T10:00:00.000Z",
    ...overrides,
  };
}

function renderTransactions() {
  const TransactionsPage = Route.options.component!;
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <TransactionsPage />
    </QueryClientProvider>,
  );
}

describe("transactions route", () => {
  it("renders the transactions returned by the API", async () => {
    listAccounts.mockResolvedValue({ accounts: [] });
    listTransactions.mockResolvedValue({
      transactions: [makeTransaction()],
      nextCursor: null,
      hasMore: false,
    });

    renderTransactions();

    expect(screen.getByText("Transactions")).toBeDefined();
    expect(await screen.findByText("Coffee Shop")).toBeDefined();
  });

  it("requests the first page with the route's page size", async () => {
    listAccounts.mockResolvedValue({ accounts: [] });
    listTransactions.mockResolvedValue({ transactions: [], nextCursor: null, hasMore: false });

    renderTransactions();

    await screen.findByText("Transactions");
    expect(listTransactions).toHaveBeenCalledWith(expect.objectContaining({ limit: 25 }));
  });
});
