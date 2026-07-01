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
import { formatCurrency } from "@/lib/utils";
import { categoryConfig } from "@spark/common";
import type { Account, SavedTransaction } from "@spark/orpc/contract";

type SortField = "date" | "description" | "category" | "amount";
type SortDirection = "asc" | "desc";

interface TransactionsTableProps {
  transactions: SavedTransaction[];
  accounts?: Account[];
}

export function TransactionsTable({ transactions, accounts = [] }: TransactionsTableProps) {
  const [sortField, setSortField] = React.useState<SortField>("date");
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("desc");

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
          comparison = Number(a.amount) - Number(b.amount);
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [transactions, sortField, sortDirection]);

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
            {sortedTransactions.map((transaction) => {
              const amount = Number(transaction.amount);
              const isCredit = transaction.transactionType === "CREDIT";
              const accountName =
                accounts.find((account) => account.accountId === transaction.accountId)
                  ?.displayName ?? transaction.accountId;

              return (
                <TableRow key={transaction.id}>
                  <TableCell className="text-muted-foreground font-mono text-xs tabular-nums">
                    {new Date(transaction.timestamp).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="font-medium">
                    {transaction.merchantName ?? transaction.description}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">{accountName}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="size-2 shrink-0"
                        style={{
                          backgroundColor: categoryConfig[transaction.transactionCategory].color,
                        }}
                      />
                      {categoryConfig[transaction.transactionCategory].label}
                    </span>
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono font-medium tabular-nums ${isCredit ? "text-success" : ""}`}
                  >
                    {isCredit ? "+" : "−"}
                    {formatCurrency(Math.abs(amount), transaction.currency)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
