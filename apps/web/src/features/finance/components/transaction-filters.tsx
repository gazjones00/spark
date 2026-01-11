import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type TransactionCategory, categoryConfig } from "@/lib/mock-data";
import type { Account } from "@spark/truelayer/types";

export interface TransactionFilters {
  search: string;
  category: TransactionCategory | "all";
  accountId: string | "all";
  dateRange: "all" | "7days" | "30days" | "90days";
}

interface TransactionFiltersProps {
  filters: TransactionFilters;
  onFiltersChange: (filters: TransactionFilters) => void;
  accounts?: Account[];
}

const categories: (TransactionCategory | "all")[] = [
  "all",
  "PURCHASE",
  "TRANSFER",
  "DIRECT_DEBIT",
  "STANDING_ORDER",
  "BILL_PAYMENT",
  "ATM",
  "CASH",
  "CREDIT",
  "DEBIT",
  "INTEREST",
  "DIVIDEND",
  "FEE_CHARGE",
  "OTHER",
];

export function TransactionFiltersBar({
  filters,
  onFiltersChange,
  accounts = [],
}: TransactionFiltersProps) {
  const hasActiveFilters =
    filters.search ||
    filters.category !== "all" ||
    filters.accountId !== "all" ||
    filters.dateRange !== "all";

  const clearFilters = () => {
    onFiltersChange({
      search: "",
      category: "all",
      accountId: "all",
      dateRange: "all",
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
        <Input
          placeholder="Search transactions..."
          value={filters.search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          className="pl-9"
        />
      </div>

      <Select
        value={filters.category}
        onValueChange={(value) =>
          onFiltersChange({
            ...filters,
            category: value as TransactionCategory | "all",
          })
        }
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {categories.map((cat) => (
            <SelectItem key={cat} value={cat}>
              {cat === "all" ? "All Categories" : categoryConfig[cat].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.accountId}
        onValueChange={(value) => onFiltersChange({ ...filters, accountId: value ?? "all" })}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Accounts</SelectItem>
          {accounts.map((account) => (
            <SelectItem key={account.accountId} value={account.accountId}>
              {account.displayName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.dateRange}
        onValueChange={(value) =>
          onFiltersChange({
            ...filters,
            dateRange: value as TransactionFilters["dateRange"],
          })
        }
      >
        <SelectTrigger className="w-[130px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Time</SelectItem>
          <SelectItem value="7days">Last 7 Days</SelectItem>
          <SelectItem value="30days">Last 30 Days</SelectItem>
          <SelectItem value="90days">Last 90 Days</SelectItem>
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="mr-1 size-4" />
          Clear
        </Button>
      )}
    </div>
  );
}
