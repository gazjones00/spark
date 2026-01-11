import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";

import {
  TransactionFiltersBar,
  type TransactionFilters,
} from "@/features/finance/components/transaction-filters";
import { TransactionsTable } from "@/features/finance/components/transactions-table";
import { mockAccounts, mockTransactions } from "@/lib/mock-data";

export const Route = createFileRoute("/_authenticated/transactions")({
  component: TransactionsPage,
});

function TransactionsPage() {
  const [filters, setFilters] = React.useState<TransactionFilters>({
    search: "",
    category: "all",
    accountId: "all",
    dateRange: "all",
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
        <p className="text-muted-foreground text-sm">View and search your transaction history</p>
      </div>

      <TransactionFiltersBar
        filters={filters}
        onFiltersChange={setFilters}
        accounts={mockAccounts}
      />

      <TransactionsTable transactions={mockTransactions} accounts={mockAccounts} />
    </div>
  );
}
