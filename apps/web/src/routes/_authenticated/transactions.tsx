import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

import {
  TransactionFiltersBar,
  type TransactionFilters,
} from "@/features/finance/components/transaction-filters";
import { TransactionsTable } from "@/features/finance/components/transactions-table";
import { orpc } from "@spark/orpc";

export const Route = createFileRoute("/_authenticated/transactions")({
  component: TransactionsPage,
});

const PAGE_SIZE = 25;

function TransactionsPage() {
  const [filters, setFilters] = React.useState<TransactionFilters>({
    search: "",
    category: "all",
    accountId: "all",
    dateRange: "all",
  });
  const [cursor, setCursor] = React.useState<string | undefined>();
  const [cursorHistory, setCursorHistory] = React.useState<string[]>([]);
  const deferredSearch = React.useDeferredValue(filters.search);

  React.useEffect(() => {
    setCursor(undefined);
    setCursorHistory([]);
  }, [filters.accountId, filters.category, filters.dateRange, deferredSearch]);

  const accountsQuery = useQuery({
    queryKey: ["accounts"],
    queryFn: () => orpc.accounts.list.call({}),
  });

  const transactionQueryInput = React.useMemo(() => {
    const input: Parameters<typeof orpc.transactions.list.call>[0] = {
      limit: PAGE_SIZE,
    };

    if (cursor) {
      input.cursor = cursor;
    }

    const search = deferredSearch.trim();
    if (search) {
      input.search = search;
    }

    if (filters.accountId !== "all") {
      input.accountId = filters.accountId;
    }

    if (filters.category !== "all") {
      input.category = filters.category;
    }

    if (filters.dateRange !== "all") {
      const daysByRange = {
        "7days": 7,
        "30days": 30,
        "90days": 90,
      } as const;
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - daysByRange[filters.dateRange]);
      input.from = fromDate.toISOString();
    }

    return input;
  }, [cursor, deferredSearch, filters.accountId, filters.category, filters.dateRange]);

  const transactionsQuery = useQuery({
    queryKey: ["transactions", transactionQueryInput],
    queryFn: () => orpc.transactions.list.call(transactionQueryInput),
    refetchOnMount: "always",
    placeholderData: keepPreviousData,
  });

  const accounts = accountsQuery.data?.accounts ?? [];
  const transactionsData = transactionsQuery.data;

  const goToNextPage = () => {
    if (!transactionsData?.nextCursor) {
      return;
    }
    setCursorHistory((previous) => [...previous, cursor ?? ""]);
    setCursor(transactionsData.nextCursor);
  };

  const goToPreviousPage = () => {
    if (cursorHistory.length === 0) {
      return;
    }
    const previousCursor = cursorHistory[cursorHistory.length - 1];
    setCursor(previousCursor || undefined);
    setCursorHistory((previous) => previous.slice(0, -1));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
        <p className="text-muted-foreground text-sm">View and search your transaction history</p>
      </div>

      <TransactionFiltersBar filters={filters} onFiltersChange={setFilters} accounts={accounts} />

      <TransactionsTable transactions={transactionsData?.transactions ?? []} accounts={accounts} />

      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Showing {transactionsData?.transactions.length ?? 0} transactions
        </p>
        <div className="flex items-center gap-2">
          {transactionsQuery.isFetching && (
            <Loader2 className="text-muted-foreground size-4 animate-spin" />
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={goToPreviousPage}
            disabled={cursorHistory.length === 0 || transactionsQuery.isFetching}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={goToNextPage}
            disabled={!transactionsData?.hasMore || transactionsQuery.isFetching}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
