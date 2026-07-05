import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { queryKeys } from "@/lib/query-keys";
import { formatCurrency } from "@/lib/utils";
import { useCategories } from "@/features/finance/hooks/useCategories";
import { orpc } from "@spark/orpc";
import type { Account, SavedTransaction } from "@spark/orpc/contract";

type SortField = "date" | "description" | "category" | "amount";
type SortDirection = "asc" | "desc";

/** Sentinel select value for "remove my override, back to rules/defaults". */
const RESET_TO_AUTOMATIC = "__RESET_TO_AUTOMATIC__";

interface TransactionsTableProps {
  transactions: SavedTransaction[];
  accounts?: Account[];
}

export function TransactionsTable({ transactions, accounts = [] }: TransactionsTableProps) {
  const [sortField, setSortField] = React.useState<SortField>("date");
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("desc");
  const queryClient = useQueryClient();
  const { categories, resolve } = useCategories();

  const setCategoryMutation = useMutation({
    mutationFn: (input: { transactionId: string; category: string }) =>
      orpc.transactions.setCategory.call(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
    },
    onError: () => {
      toast.error("Failed to update category");
    },
  });

  const clearCategoryMutation = useMutation({
    mutationFn: (input: { transactionId: string }) => orpc.transactions.clearCategory.call(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
      toast.success("Category reset — rules apply again");
    },
    onError: () => {
      toast.error("Failed to reset category");
    },
  });

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
          // Stored categories are opaque ids (custom ones are UUIDs); sort by
          // the label the user actually sees.
          comparison = resolve(a.category).label.localeCompare(resolve(b.category).label);
          break;
        case "amount":
          comparison = Number(a.amount) - Number(b.amount);
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [transactions, sortField, sortDirection, resolve]);

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
              const merchantLabel =
                transaction.merchant?.displayName ??
                transaction.merchantName ??
                transaction.description;
              const isManual = transaction.categorySource === "USER_OVERRIDE";

              return (
                <TableRow key={transaction.id}>
                  <TableCell className="text-muted-foreground font-mono text-xs tabular-nums">
                    {new Date(transaction.timestamp).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="font-medium">{merchantLabel}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{accountName}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    <span className="inline-flex items-center gap-1.5">
                      <Select
                        value={transaction.category}
                        onValueChange={(value) => {
                          if (value === RESET_TO_AUTOMATIC) {
                            clearCategoryMutation.mutate({ transactionId: transaction.id });
                          } else if (value && value !== transaction.category) {
                            setCategoryMutation.mutate({
                              transactionId: transaction.id,
                              category: value,
                            });
                          }
                        }}
                      >
                        <SelectTrigger
                          size="sm"
                          className="border-transparent hover:border-input min-w-[130px]"
                          aria-label={`Category for ${merchantLabel}`}
                        >
                          <span
                            className="size-2 shrink-0"
                            style={{ backgroundColor: resolve(transaction.category).color }}
                          />
                          <SelectValue>{resolve(transaction.category).label}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.label}
                            </SelectItem>
                          ))}
                          {isManual && (
                            <>
                              <SelectSeparator />
                              <SelectItem value={RESET_TO_AUTOMATIC}>Reset to automatic</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                      {isManual && (
                        <Badge
                          variant="outline"
                          className="text-muted-foreground h-4 px-1 text-[10px]"
                          title="Categorized manually — rules never change this transaction. Choose “Reset to automatic” to let rules apply again."
                        >
                          Manual
                        </Badge>
                      )}
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
