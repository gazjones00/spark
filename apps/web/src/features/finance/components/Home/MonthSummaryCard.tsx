import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney, formatSignedMoney } from "@/features/finance/lib/money";
import { cn } from "@/lib/utils";

interface MonthSummaryCardProps {
  income: number;
  expenses: number;
  currency?: string;
  previousMonth: { income: number; expenses: number } | null;
}

/**
 * Money in and out so far this month (transfers between your own accounts
 * don't count). Mid-month, comparing against what came in is misleading —
 * payday may not have happened yet — so the pace shown is spending against
 * last month's total.
 */
export function MonthSummaryCard({
  income,
  expenses,
  currency,
  previousMonth,
}: MonthSummaryCardProps) {
  const net = income - expenses;
  const monthName = new Date().toLocaleDateString("en-GB", { month: "long" });
  const lastSpend = previousMonth?.expenses ?? 0;
  const pace = lastSpend > 0 ? expenses / lastSpend : undefined;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>This month</CardTitle>
        <p className="text-muted-foreground text-sm">{monthName} so far</p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-5">
        <div className="grid grid-cols-2 gap-3">
          <Flow
            icon={<ArrowDownLeft className="size-4" />}
            label="Money in"
            value={formatMoney(income, currency)}
            tone="in"
          />
          <Flow
            icon={<ArrowUpRight className="size-4" />}
            label="Money out"
            value={formatMoney(expenses, currency)}
            tone="out"
          />
        </div>

        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">Net so far</span>
          <span className={cn("figure font-medium", net >= 0 ? "text-success" : "text-foreground")}>
            {formatSignedMoney(net, currency)}
          </span>
        </div>

        {pace !== undefined ? (
          <div className="border-border mt-auto border-t pt-4">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">Spending vs last month</span>
              <span className="text-foreground font-semibold tabular-nums">
                {Math.round(pace * 100)}%
              </span>
            </div>
            <div
              className="bg-muted mt-2 h-2 overflow-hidden rounded-full"
              role="img"
              aria-label={`Spent ${Math.round(pace * 100)}% of last month's total so far`}
            >
              <div
                className={cn("h-full rounded-full", pace > 1 ? "bg-warning" : "bg-primary")}
                style={{ width: `${Math.min(pace, 1) * 100}%` }}
              />
            </div>
            <p className="text-muted-foreground mt-2 text-xs">
              {formatMoney(lastSpend, currency)} spent in total last month
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Flow({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "in" | "out";
}) {
  return (
    <div className="bg-muted/60 rounded-xl p-3">
      <span
        className={cn(
          "inline-flex size-7 items-center justify-center rounded-full",
          tone === "in" ? "bg-success/12 text-success" : "bg-primary/10 text-primary",
        )}
      >
        {icon}
      </span>
      <p className="text-muted-foreground mt-2 text-xs font-medium">{label}</p>
      <p className="figure text-foreground mt-0.5 text-lg font-medium">{value}</p>
    </div>
  );
}
