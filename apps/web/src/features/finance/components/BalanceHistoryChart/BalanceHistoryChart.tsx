import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type BalanceHistory } from "@/features/finance/lib/dashboard-derivations";
import { formatCurrency } from "@/lib/utils";

const chartConfig = {
  balance: {
    label: "Balance",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

interface BalanceHistoryChartProps {
  data: BalanceHistory[];
  /** Currency to label the axis/tooltip; falls back to the formatter default. */
  currency?: string;
}

export function BalanceHistoryChart({ data, currency }: BalanceHistoryChartProps) {
  const compactCurrency = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency ?? "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Balance over time
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-muted-foreground flex h-[200px] flex-col items-center justify-center rounded-none border border-dashed text-center">
            <p className="text-sm">No balance history available.</p>
            <p className="text-xs">
              Balance over time appears once your transactions include running balances.
            </p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[200px] w-full">
            <AreaChart data={data} margin={{ left: 0, right: 0 }}>
              <CartesianGrid strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
                }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
                tickFormatter={(value) => compactCurrency.format(value)}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => [formatCurrency(Number(value), currency), "Balance"]}
                  />
                }
              />
              <Area
                type="linear"
                dataKey="balance"
                stroke="var(--chart-1)"
                fill="var(--chart-1)"
                fillOpacity={0.12}
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
