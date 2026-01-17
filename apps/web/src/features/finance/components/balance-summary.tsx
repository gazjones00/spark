import { formatCurrency } from "@/lib/utils";

interface BalanceSummaryProps {
  totalBalance: number;
}

export function BalanceSummary({ totalBalance }: BalanceSummaryProps) {
  const isPositive = totalBalance >= 0;

  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-sm font-medium">Net Worth</p>
      <p
        className={`text-3xl font-bold tracking-tight ${
          isPositive ? "text-foreground" : "text-destructive"
        }`}
      >
        {formatCurrency(totalBalance)}
      </p>
    </div>
  );
}
