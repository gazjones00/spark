import * as React from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { type Transaction, type Account } from "@spark/truelayer/types";
import { formatCurrency } from "@/lib/utils";

type SortField = "date" | "description" | "category" | "amount";
type SortDirection = "asc" | "desc";

interface TransactionsTableProps {
  transactions: Transaction[];
  accounts?: Account[];
}

export function TransactionsTable({ transactions, accounts = [] }: TransactionsTableProps) {
  const [sortField, setSortField] = React.useState<SortField>("date");
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 10;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortedTransactions = React.useMemo(() => {
    return [...transactions].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "date":
          comparison = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          break;
        case "description":
          comparison = (a.merchantName ?? a.description).localeCompare(
            b.merchantName ?? b.description,
          );
          break;
        case "category":
          comparison = a.transactionCategory.localeCompare(b.transactionCategory);
          break;
        case "amount":
          comparison = a.amount - b.amount;
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [transactions, sortField, sortDirection]);

  const totalPages = Math.ceil(sortedTransactions.length / itemsPerPage);
  const paginatedTransactions = sortedTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 size-3" />;
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-1 size-3" />
    ) : (
      <ArrowDown className="ml-1 size-3" />
    );
  };

  if (transactions.length === 0) {
    return (
      <div className="text-muted-foreground rounded-none border border-dashed p-8 text-center">
        <p className="text-sm">No transactions found.</p>
        <p className="text-xs">Connect a bank account to see your transactions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-none border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button
                  className="flex items-center font-medium hover:text-foreground"
                  onClick={() => handleSort("date")}
                >
                  Date
                  <SortIcon field="date" />
                </button>
              </TableHead>
              <TableHead>
                <button
                  className="flex items-center font-medium hover:text-foreground"
                  onClick={() => handleSort("description")}
                >
                  Description
                  <SortIcon field="description" />
                </button>
              </TableHead>
              <TableHead>Account</TableHead>
              <TableHead>
                <button
                  className="flex items-center font-medium hover:text-foreground"
                  onClick={() => handleSort("category")}
                >
                  Category
                  <SortIcon field="category" />
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button
                  className="flex items-center font-medium hover:text-foreground ml-auto"
                  onClick={() => handleSort("amount")}
                >
                  Amount
                  <SortIcon field="amount" />
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedTransactions.map((transaction) => {
              const amount = transaction.amount;
              const isCredit = transaction.transactionType === "CREDIT";

              return (
                <TableRow key={transaction.transactionId}>
                  <TableCell className="text-muted-foreground">
                    {new Date(transaction.timestamp).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="font-medium">
                    {transaction.merchantName ?? transaction.description}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {accounts.find((a) => a.accountId === transaction.providerTransactionId)
                      ?.displayName ?? transaction.providerTransactionId}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${isCredit ? "text-chart-3" : ""}`}>
                    {isCredit ? "+" : "-"}
                    {formatCurrency(Math.abs(amount), transaction.currency)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
            {Math.min(currentPage * itemsPerPage, transactions.length)} of {transactions.length}{" "}
            transactions
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="text-muted-foreground text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
