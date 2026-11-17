import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";

interface QuickStatsProps {
  netWorth: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  /** Currency to format the figures in; falls back to `formatCurrency`'s default. */
  currency?: string;
}

export function QuickStats({
  netWorth,
  monthlyIncome,
  monthlyExpenses,
  currency,
}: QuickStatsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <StatCard label="Net worth" value={formatCurrency(netWorth, currency)} primary />
      <StatCard
        label="Income · this month"
        value={`+${formatCurrency(monthlyIncome, currency)}`}
        valueClassName="text-success"
      />
      <StatCard
        label="Expenses · this month"
        value={`−${formatCurrency(monthlyExpenses, currency)}`}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  primary = false,
  valueClassName,
}: {
  label: string;
  value: string;
  /** The lead figure, set on the brand gradient. */
  primary?: boolean;
  valueClassName?: string;
}) {
  return (
    <Card className={cn(primary && "bg-spark-gradient border-transparent text-white")}>
      <CardContent className="py-1">
        <p
          className={cn("text-sm font-medium", primary ? "text-white/85" : "text-muted-foreground")}
        >
          {label}
        </p>
        <p className={cn("figure mt-2 text-2xl font-bold sm:text-3xl", valueClassName)}>{value}</p>
      </CardContent>
    </Card>
  );
}
