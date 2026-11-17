import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SpendingByCategory } from "@/features/finance/lib/dashboard-derivations";
import { formatMoney } from "@/features/finance/lib/money";

const TOP_CATEGORIES = 6;

interface SpendingBreakdownProps {
  data: SpendingByCategory[];
  currency?: string;
}

/** Where the money went this month, biggest first; each row opens those transactions. */
export function SpendingBreakdown({ data, currency }: SpendingBreakdownProps) {
  const sorted = [...data].filter((entry) => entry.amount > 0).sort((a, b) => b.amount - a.amount);
  const total = sorted.reduce((sum, entry) => sum + entry.amount, 0);
  const top = sorted.slice(0, TOP_CATEGORIES);
  const rest = sorted.slice(TOP_CATEGORIES);
  const restTotal = rest.reduce((sum, entry) => sum + entry.amount, 0);

  return (
    <Card>
      <CardHeader className="flex items-start justify-between">
        <div>
          <CardTitle>Spending by category</CardTitle>
          <p className="text-muted-foreground text-sm">This month</p>
        </div>
        {total > 0 ? (
          <p className="figure text-foreground text-lg font-bold">{formatMoney(total, currency)}</p>
        ) : null}
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            No spending yet this month.
          </p>
        ) : (
          <>
            {/* One stacked bar for the overall shape, then the ranked list. */}
            <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
              {sorted.map((entry) => (
                <span
                  key={entry.category}
                  style={{ width: `${(entry.amount / total) * 100}%`, backgroundColor: entry.fill }}
                />
              ))}
            </div>
            <ul className="mt-4 -mx-2">
              {top.map((entry) => (
                <li key={entry.category}>
                  <Link
                    to="/transactions"
                    search={{ category: entry.category }}
                    className="hover:bg-muted group flex items-center gap-3 rounded-lg px-2 py-2"
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: entry.fill }}
                    />
                    <span className="text-foreground flex-1 truncate text-sm font-medium">
                      {entry.label}
                    </span>
                    <span className="text-muted-foreground w-12 text-right text-xs tabular-nums">
                      {Math.round((entry.amount / total) * 100)}%
                    </span>
                    <span className="figure text-foreground w-24 text-right text-sm font-semibold">
                      {formatMoney(entry.amount, currency)}
                    </span>
                    <ChevronRight className="text-muted-foreground size-4 opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
              {restTotal > 0 ? (
                <li className="flex items-center gap-3 px-2 py-2">
                  <span className="bg-chart-10 size-2.5 shrink-0 rounded-full" />
                  <span className="text-muted-foreground flex-1 text-sm">
                    {rest.length} more {rest.length === 1 ? "category" : "categories"}
                  </span>
                  <span className="text-muted-foreground w-12 text-right text-xs tabular-nums">
                    {Math.round((restTotal / total) * 100)}%
                  </span>
                  <span className="figure text-muted-foreground w-24 text-right text-sm font-semibold">
                    {formatMoney(restTotal, currency)}
                  </span>
                  <span className="size-4" />
                </li>
              ) : null}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
