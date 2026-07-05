import { Pie, PieChart, Cell } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type SpendingByCategory } from "@/features/finance/lib/dashboard-derivations";
import { formatCurrency } from "@/lib/utils";

interface SpendingChartProps {
  data: SpendingByCategory[];
  /** Currency to label the tooltip; falls back to the formatter default. */
  currency?: string;
}

export function SpendingChart({ data, currency }: SpendingChartProps) {
  // Slices arrive already resolved (label + colour), including custom
  // categories the built-in config knows nothing about.
  const chartConfig = data.reduce((acc, item) => {
    acc[item.category] = {
      label: item.label,
      color: item.fill,
    };
    return acc;
  }, {} as ChartConfig);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Spending by category
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="mx-auto h-[200px] w-full">
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => [
                    formatCurrency(Number(value), currency),
                    chartConfig[name as string]?.label ?? name,
                  ]}
                />
              }
            />
            <Pie
              data={data}
              dataKey="amount"
              nameKey="category"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="mt-4 flex flex-wrap justify-center gap-4">
          {data.slice(0, 5).map((item) => (
            <div key={item.category} className="flex items-center gap-2">
              <div className="size-2.5" style={{ backgroundColor: item.fill }} />
              <span className="text-muted-foreground font-mono text-[10px] font-medium uppercase tracking-[0.1em]">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
