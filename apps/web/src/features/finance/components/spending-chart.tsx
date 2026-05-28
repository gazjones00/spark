import { Pie, PieChart, Cell } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { categoryConfig } from "@spark/common";
import { type SpendingByCategory } from "@/features/finance/lib/dashboard-derivations";
import { formatCurrency } from "@/lib/utils";

interface SpendingChartProps {
  data: SpendingByCategory[];
  /** Currency to label the tooltip; falls back to the formatter default. */
  currency?: string;
}

export function SpendingChart({ data, currency }: SpendingChartProps) {
  const chartConfig = data.reduce((acc, item) => {
    acc[item.category] = {
      label: categoryConfig[item.category].label,
      color: item.fill,
    };
    return acc;
  }, {} as ChartConfig);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Spending by Category</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="mx-auto h-[200px] w-full">
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => [
                    formatCurrency(Number(value), currency),
                    categoryConfig[name as keyof typeof categoryConfig]?.label || name,
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
              <div className="size-3 rounded-none" style={{ backgroundColor: item.fill }} />
              <span className="text-muted-foreground text-xs">
                {categoryConfig[item.category].label}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
