import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCategories } from "@/features/finance/hooks/useCategories";
import type { Account } from "@spark/orpc/contract";

export const DATE_RANGES = {
  "7d": { label: "Last 7 days", days: 7 },
  "30d": { label: "Last 30 days", days: 30 },
  "90d": { label: "Last 90 days", days: 90 },
} as const;
export type DateRange = keyof typeof DATE_RANGES;

export interface TransactionFilters {
  search: string;
  category?: string;
  account?: string;
  range?: DateRange;
}

interface TransactionFiltersProps {
  filters: TransactionFilters;
  onFiltersChange: (filters: TransactionFilters) => void;
  accounts?: Account[];
}

const ALL = "all";

/** Search plus labelled account / category / date filters. */
export function TransactionFiltersBar({
  filters,
  onFiltersChange,
  accounts = [],
}: TransactionFiltersProps) {
  const { categories, resolve } = useCategories();
  const active = Boolean(filters.search || filters.category || filters.account || filters.range);
  const accountName = accounts.find(
    (account) => account.accountId === filters.account,
  )?.displayName;

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="relative flex-1">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          type="search"
          aria-label="Search transactions"
          placeholder="Search merchants and descriptions"
          value={filters.search}
          onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
          className="pl-9"
        />
      </div>

      <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 lg:pb-0">
        <FilterSelect
          label="Category"
          value={filters.category ?? ALL}
          display={filters.category ? resolve(filters.category).label : "All"}
          onChange={(value) =>
            onFiltersChange({ ...filters, category: value === ALL ? undefined : value })
          }
          options={[
            { value: ALL, label: "All categories" },
            ...categories.map((category) => ({ value: category.id, label: category.label })),
          ]}
        />
        <FilterSelect
          label="Account"
          value={filters.account ?? ALL}
          display={accountName ?? "All"}
          onChange={(value) =>
            onFiltersChange({ ...filters, account: value === ALL ? undefined : value })
          }
          options={[
            { value: ALL, label: "All accounts" },
            ...accounts.map((account) => ({
              value: account.accountId,
              label: account.displayName,
            })),
          ]}
        />
        <FilterSelect
          label="Date"
          value={filters.range ?? ALL}
          display={filters.range ? DATE_RANGES[filters.range].label : "Any time"}
          onChange={(value) =>
            onFiltersChange({ ...filters, range: value === ALL ? undefined : (value as DateRange) })
          }
          options={[
            { value: ALL, label: "Any time" },
            ...Object.entries(DATE_RANGES).map(([value, range]) => ({ value, label: range.label })),
          ]}
        />
        {active ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onFiltersChange({ search: "" })}
            className="shrink-0"
          >
            <X />
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  display,
  onChange,
  options,
}: {
  label: string;
  value: string;
  display: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  const selected = value !== ALL;
  return (
    <Select value={value} onValueChange={(next) => onChange(next ?? ALL)}>
      <SelectTrigger
        aria-label={`Filter by ${label.toLowerCase()}`}
        className={
          selected ? "border-primary/40 bg-accent text-accent-foreground shrink-0" : "shrink-0"
        }
      >
        <span className="text-muted-foreground">{label}:</span>
        <SelectValue>
          <span className="max-w-36 truncate font-medium">{display}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
