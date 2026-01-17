import { TrendingUp, TrendingDown, Wallet } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface QuickStatsProps {
  netWorth: number;
  monthlyIncome: number;
  monthlyExpenses: number;
}

export function QuickStats({ netWorth, monthlyIncome, monthlyExpenses }: QuickStatsProps) {
  const stats = [
    {
      label: "Net Worth",
      value: netWorth,
      icon: Wallet,
      color: "text-foreground",
    },
    {
      label: "Income (This Month)",
      value: monthlyIncome,
      icon: TrendingUp,
      color: "text-chart-3",
    },
    {
      label: "Expenses (This Month)",
      value: monthlyExpenses,
      icon: TrendingDown,
      color: "text-chart-1",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-muted rounded-none p-2">
                <stat.icon className={`size-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium">{stat.label}</p>
                <p className={`text-xl font-bold ${stat.color}`}>{formatCurrency(stat.value)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
