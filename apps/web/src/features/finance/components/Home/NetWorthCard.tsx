import { TrendingDown, TrendingUp } from "lucide-react";
import { Area, AreaChart, XAxis, YAxis } from "recharts";

import { SegmentedControl } from "@/components/segmented-control";
import { Card, CardContent } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import type { BalanceHistory } from "@/features/finance/lib/dashboard-derivations";
import {
  formatCompactMoney,
  formatMoney,
  formatPercentChange,
  formatSignedMoney,
} from "@/features/finance/lib/money";
import { SERIES_RANGES, type SeriesRange } from "@/features/finance/lib/series-ranges";
import { cn } from "@/lib/utils";

const RANGE_LABELS: Record<SeriesRange, string> = {
  "1M": "past month",
  "3M": "past 3 months",
  "6M": "past 6 months",
  "1Y": "past year",
};

const chartConfig = {
  balance: { label: "Net worth", color: "var(--chart-1)" },
} satisfies ChartConfig;

interface NetWorthCardProps {
  netWorth: number;
  currency?: string;
  series: BalanceHistory[];
  range: SeriesRange;
  onRangeChange: (range: SeriesRange) => void;
}

/** The headline: what you're worth, how it moved, and the shape of the trend. */
export function NetWorthCard({
  netWorth,
  currency,
  series,
  range,
  onRangeChange,
}: NetWorthCardProps) {
  const first = series.at(0)?.balance;
  const last = series.at(-1)?.balance;
  const change = first !== undefined && last !== undefined ? last - first : undefined;
  const percent =
    change !== undefined && first !== undefined ? formatPercentChange(change, first) : undefined;
  const rising = (change ?? 0) >= 0;
  const values = series.map((point) => point.balance);
  const low = Math.min(...values);
  const high = Math.max(...values);
  // Pad the y-range so a flat month still shows movement without exaggerating it.
  const pad = Math.max((high - low) * 0.15, Math.abs(high) * 0.01, 1);

  return (
    <Card className="gap-0 pb-0">
      <CardContent className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-sm font-medium">Net worth</p>
          <p className="figure text-foreground mt-1 text-4xl font-bold sm:text-[2.75rem]">
            {formatMoney(netWorth, currency)}
          </p>
          {change !== undefined ? (
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold",
                  rising ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
                )}
              >
                {rising ? (
                  <TrendingUp className="size-3.5" />
                ) : (
                  <TrendingDown className="size-3.5" />
                )}
                {formatSignedMoney(change, currency)}
                {percent ? <span className="font-medium opacity-80">({percent})</span> : null}
              </span>
              <span className="text-muted-foreground">{RANGE_LABELS[range]}</span>
            </p>
          ) : null}
        </div>
        <SegmentedControl
          label="Chart range"
          value={range}
          options={Object.keys(SERIES_RANGES) as SeriesRange[]}
          onChange={onRangeChange}
        />
      </CardContent>

      {series.length > 1 ? (
        <ChartContainer config={chartConfig} className="mt-4 aspect-auto h-44 w-full sm:h-56">
          <AreaChart data={series} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="net-worth-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" hide />
            <YAxis hide domain={[low - pad, high + pad]} />
            <ChartTooltip
              cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
              content={({ active, payload }) => {
                const point = payload?.[0]?.payload as BalanceHistory | undefined;
                if (!active || !point) return null;
                return (
                  <div className="bg-popover text-popover-foreground ring-border rounded-lg px-3 py-2 text-xs shadow-lg ring-1">
                    <p className="text-muted-foreground">
                      {new Date(point.date).toLocaleDateString("en-GB", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                    <p className="figure mt-0.5 text-sm font-bold">
                      {formatMoney(point.balance, currency)}
                    </p>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="balance"
              stroke="var(--chart-1)"
              strokeWidth={2.25}
              fill="url(#net-worth-fill)"
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
            />
          </AreaChart>
        </ChartContainer>
      ) : (
        <p className="text-muted-foreground px-5 pt-4 pb-6 text-sm">
          Your net worth trend appears once your accounts have synced.
        </p>
      )}
      {series.length > 1 ? (
        <div className="text-muted-foreground flex justify-between px-5 pt-1 pb-4 text-xs">
          <span>{axisDate(series.at(0)?.date)}</span>
          <span>
            Low {formatCompactMoney(low, currency)} · High {formatCompactMoney(high, currency)}
          </span>
          <span>{axisDate(series.at(-1)?.date)}</span>
        </div>
      ) : null}
    </Card>
  );
}

function axisDate(date: string | undefined): string {
  return date ? new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";
}
