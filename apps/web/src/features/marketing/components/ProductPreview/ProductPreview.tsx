import type { ReactNode } from "react";

import { ArrowDownLeft, ArrowUpRight, TrendingUp } from "lucide-react";

import { SparkLogo } from "@/components/spark-mark";
import { cn } from "@/lib/utils";

/*
 * A static, coded rendering of the Home screen for the landing page. It is
 * built from the same tokens as the app, so it follows the theme and stays
 * crisp at any size, and it never shows anyone's real data.
 */

// Net worth over ~3 months on a 600×180 canvas: salary steps, steady spending.
const LINE =
  "M0 132 L36 136 L60 140 L72 96 L96 102 L132 110 L168 116 L192 120 L204 78 L228 84 L264 92 L300 98 L330 104 L342 62 L366 68 L402 76 L438 82 L468 88 L480 46 L504 52 L540 60 L570 64 L600 58";

const CATEGORIES = [
  { name: "Housing", amount: "£1,150.00", share: 48, color: "var(--chart-1)" },
  { name: "Groceries", amount: "£412.60", share: 17, color: "var(--chart-11)" },
  { name: "Eating out", amount: "£236.15", share: 10, color: "var(--chart-8)" },
  { name: "Transport", amount: "£148.90", share: 6, color: "var(--chart-5)" },
] as const;

const ACTIVITY = [
  {
    name: "Lidl",
    detail: "Groceries · Current account",
    amount: "−£63.87",
    tint: "var(--chart-11)",
  },
  {
    name: "Monmouth Coffee",
    detail: "Eating out · Credit card",
    amount: "−£4.23",
    tint: "var(--chart-8)",
  },
  {
    name: "Salary",
    detail: "Income · Current account",
    amount: "+£3,490.16",
    tint: "var(--chart-7)",
  },
] as const;

export function ProductPreview({ className }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="The Spark home screen, showing net worth, this month's money in and out, spending by category and recent activity"
      className={cn(
        "bg-card/80 border-border rounded-[1.25rem] border p-2 shadow-[0_40px_80px_-30px_rgb(52_32_120/0.35)] backdrop-blur",
        className,
      )}
    >
      <div className="bg-background overflow-hidden rounded-[0.9rem] border">
        <div className="border-border flex items-center justify-between border-b px-4 py-3">
          <SparkLogo markClassName="size-4" className="[&>span:last-child]:text-base" />
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="bg-border size-2 rounded-full" />
            <span className="bg-border size-2 rounded-full" />
            <span className="bg-border size-2 rounded-full" />
          </div>
        </div>

        <div className="grid gap-3 p-3 sm:p-4 md:grid-cols-[1.6fr_1fr]">
          <NetWorthPanel />
          <ThisMonthPanel />
          <SpendingPanel />
          <ActivityPanel />
        </div>
      </div>
    </div>
  );
}

function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("bg-card border-border rounded-xl border p-4 text-left", className)}>
      {children}
    </div>
  );
}

function NetWorthPanel() {
  return (
    <Panel className="pb-0">
      <p className="text-muted-foreground text-xs font-medium">Net worth</p>
      <p className="figure text-foreground mt-1 text-[1.75rem] leading-none font-bold sm:text-3xl">
        £24,318.40
      </p>
      <span className="bg-success/12 text-success mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold">
        <TrendingUp className="size-3" />
        +£1,212.55 (+5.2%)
      </span>
      <svg
        viewBox="0 0 600 180"
        preserveAspectRatio="none"
        className="-mx-4 mt-2 block h-28 w-[calc(100%+2rem)] sm:h-36"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="preview-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={`${LINE} L600 180 L0 180 Z`}
          fill="url(#preview-fill)"
          className="animate-spark-fade"
        />
        <path
          d={LINE}
          fill="none"
          stroke="var(--chart-1)"
          strokeWidth="2.25"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          className="animate-spark-draw"
        />
      </svg>
    </Panel>
  );
}

function ThisMonthPanel() {
  return (
    <Panel className="flex flex-col">
      <p className="text-foreground text-sm font-semibold">This month</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Flow icon={ArrowDownLeft} label="Money in" value="£3,490.16" tone="success" />
        <Flow icon={ArrowUpRight} label="Money out" value="£2,104.87" tone="primary" />
      </div>
      <div className="mt-auto pt-4">
        <div className="text-muted-foreground flex justify-between text-xs">
          <span>Spending vs last month</span>
          <span className="text-foreground font-semibold">71%</span>
        </div>
        <div className="bg-muted mt-1.5 h-1.5 overflow-hidden rounded-full">
          <div className="bg-primary h-full w-[71%] rounded-full" />
        </div>
      </div>
    </Panel>
  );
}

function Flow({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof ArrowDownLeft;
  label: string;
  value: string;
  tone: "success" | "primary";
}) {
  return (
    <div className="bg-muted/70 rounded-lg p-2.5">
      <span
        className={cn(
          "inline-flex size-5 items-center justify-center rounded-full",
          tone === "success" ? "bg-success/15 text-success" : "bg-primary/12 text-primary",
        )}
      >
        <Icon className="size-3" />
      </span>
      <p className="text-muted-foreground mt-1.5 text-[11px]">{label}</p>
      <p className="figure text-foreground text-sm font-bold">{value}</p>
    </div>
  );
}

function SpendingPanel() {
  return (
    <Panel className="hidden sm:block">
      <div className="flex items-baseline justify-between">
        <p className="text-foreground text-sm font-semibold">Spending by category</p>
        <p className="figure text-foreground text-sm font-bold">£2,104.87</p>
      </div>
      <div className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full">
        {CATEGORIES.map((category) => (
          <span
            key={category.name}
            style={{ width: `${category.share}%`, backgroundColor: category.color }}
          />
        ))}
        <span className="bg-muted-foreground/30 flex-1" />
      </div>
      <ul className="mt-3 space-y-2">
        {CATEGORIES.map((category) => (
          <li key={category.name} className="flex items-center gap-2 text-xs">
            <span className="size-2 rounded-full" style={{ backgroundColor: category.color }} />
            <span className="text-foreground flex-1">{category.name}</span>
            <span className="text-muted-foreground w-8 text-right">{category.share}%</span>
            <span className="figure text-foreground w-16 text-right font-semibold">
              {category.amount}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function ActivityPanel() {
  return (
    <Panel className="hidden sm:block">
      <p className="text-foreground text-sm font-semibold">Recent activity</p>
      <ul className="mt-3 space-y-3">
        {ACTIVITY.map((item) => (
          <li key={item.name} className="flex items-center gap-2.5">
            <span
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
              style={{
                color: item.tint,
                backgroundColor: `color-mix(in oklab, ${item.tint} 14%, transparent)`,
              }}
            >
              {item.name[0]}
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-foreground block truncate text-xs font-semibold">
                {item.name}
              </span>
              <span className="text-muted-foreground block truncate text-[11px]">
                {item.detail}
              </span>
            </span>
            <span
              className={cn(
                "figure text-xs font-semibold",
                item.amount.startsWith("+") ? "text-success" : "text-foreground",
              )}
            >
              {item.amount}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
