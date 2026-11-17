import { useId } from "react";

import { Check, X } from "lucide-react";

import { cn } from "@/lib/utils";

/*
 * Small, static vignettes of Spark's own UI for the landing page's product
 * story. Sample data only; drawn on the ink panel, so colours are fixed.
 */

const PANEL = "rounded-lg border border-white/10 bg-[#19191d] text-white shadow-2xl";
const PAPER = "rounded-lg bg-white text-[#0b0b0f] shadow-2xl";

function Initial({ letter, color }: { letter: string; color: string }) {
  return (
    <span
      className="font-display inline-flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-medium"
      style={{ backgroundColor: `${color}22`, color }}
    >
      {letter}
    </span>
  );
}

const BANKS = [
  { letter: "M", name: "Monzo", kind: "Current account", color: "#e8504a" },
  { letter: "N", name: "Nationwide", kind: "Savings", color: "#2f6fdb" },
  { letter: "A", name: "Amex", kind: "Credit card", color: "#0f8a8a" },
] as const;

export function ConnectIllustration() {
  return (
    <div aria-hidden="true" className="relative w-[19rem] pb-28 sm:w-[22rem] sm:pb-16">
      <div className={cn(PAPER, "w-[17.5rem] p-4 sm:w-72")}>
        <p className="text-xs text-[#5f5f6e]">Your banks</p>
        <ul className="mt-2 divide-y divide-[#e3e3eb]">
          {BANKS.map((bank) => (
            <li key={bank.name} className="flex items-center gap-3 py-2.5">
              <Initial letter={bank.letter} color={bank.color} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{bank.name}</span>
                <span className="block text-xs whitespace-nowrap text-[#5f5f6e]">{bank.kind}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-[#05704f]">
                <Check className="size-3.5" />
                Connected
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className={cn(PANEL, "absolute right-0 bottom-0 w-52 p-4")}>
        <p className="text-xs text-white/60">Bank access</p>
        <p className="font-display mt-1 text-2xl">Read-only</p>
        <ul className="mt-3 space-y-1.5 text-xs">
          <li className="flex items-center justify-between text-white/80">
            Balances <Check className="size-3.5 text-[#3dd68c]" />
          </li>
          <li className="flex items-center justify-between text-white/80">
            Transactions <Check className="size-3.5 text-[#3dd68c]" />
          </li>
          <li className="flex items-center justify-between text-white/50">
            Moving money <X className="size-3.5" />
          </li>
        </ul>
      </div>
    </div>
  );
}

const PAYMENTS = [
  { letter: "P", name: "Pret A Manger", category: "Eating out", dot: "#f97316", amount: "−£5.49" },
  { letter: "T", name: "Tesco", category: "Groceries", dot: "#84cc16", amount: "−£43.08" },
  { letter: "T", name: "TfL", category: "Transport", dot: "#0ea5e9", amount: "−£4.77" },
  { letter: "A", name: "Acme Ltd", category: "Salary", dot: "#16a34a", amount: "+£2,840.00" },
] as const;

export function TrackIllustration() {
  return (
    <div aria-hidden="true" className="relative w-[19rem] pb-20 sm:w-[22rem]">
      <div className={cn(PAPER, "p-4")}>
        <div className="flex items-baseline justify-between text-xs text-[#5f5f6e]">
          <span>Yesterday</span>
          <span>4 payments</span>
        </div>
        <ul className="mt-2 divide-y divide-[#e3e3eb]">
          {PAYMENTS.map((payment) => (
            <li key={payment.name} className="flex items-center gap-3 py-2.5">
              <Initial letter={payment.letter} color={payment.dot} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{payment.name}</span>
                <span className="flex items-center gap-1.5 text-xs text-[#5f5f6e]">
                  <span
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: payment.dot }}
                  />
                  {payment.category}
                </span>
              </span>
              <span
                className={cn(
                  "text-sm font-medium tabular-nums",
                  payment.amount.startsWith("+") && "text-[#05704f]",
                )}
              >
                {payment.amount}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className={cn(PANEL, "absolute -right-4 bottom-0 w-60 p-4 sm:-right-8")}>
        <div className="flex items-center justify-between">
          <p className="text-xs text-white/60">Rule</p>
          <span className="bg-ignition relative inline-flex h-4 w-7 items-center rounded-full">
            <span className="absolute right-0.5 size-3 rounded-full bg-[#111214]" />
          </span>
        </div>
        <p className="mt-2 text-sm leading-snug">
          Always file <span className="font-medium">Pret A Manger</span> as{" "}
          <span className="font-medium text-[#fdba74]">Eating out</span>
        </p>
      </div>
    </div>
  );
}

// A year of weekly net worth with a payday rhythm, on a 1200×300 canvas.
const NET_WORTH_LINE =
  "M0 243 L45 245 L89 244 L112 223 L156 227 L201 206 L245 206 L290 215 L312 187 L357 194 L402 172 L446 173 L491 151 L535 158 L580 166 L602 138 L647 137 L692 118 L736 121 L781 97 L825 105 L870 113 L892 80 L937 82 L982 67 L1026 64 L1071 40 L1115 51 L1160 54 L1200 30";

const SPENDING = [
  { name: "Housing", share: 52, color: "#8b7bff" },
  { name: "Groceries", share: 18, color: "#84cc16" },
  { name: "Eating out", share: 16, color: "#f97316" },
  { name: "Transport", share: 14, color: "#0ea5e9" },
] as const;

export function UnderstandIllustration() {
  // Rendered twice (sticky panel and inline on phones), so gradient ids must be unique.
  const id = useId();
  return (
    <div aria-hidden="true" className="relative w-[19rem] pb-20 sm:w-[22rem]">
      <div className={cn(PANEL, "overflow-hidden")}>
        <div className="p-4 pb-0">
          <p className="text-xs text-white/60">Net worth</p>
          <p className="font-display mt-1 text-3xl tracking-tight">£24,318.40</p>
          <p className="mt-2 inline-flex rounded-full bg-[#3dd68c]/15 px-2 py-0.5 text-xs font-medium text-[#3dd68c]">
            +£4,698.40 this year
          </p>
        </div>
        <svg viewBox="0 0 1200 300" preserveAspectRatio="none" className="mt-2 h-24 w-full">
          <defs>
            <linearGradient id={`${id}-line`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#f19670" />
              <stop offset="1" stopColor="#e852ad" />
            </linearGradient>
            <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#e852ad" stopOpacity="0.25" />
              <stop offset="1" stopColor="#e852ad" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${NET_WORTH_LINE} L1200 300 L0 300 Z`} fill={`url(#${id}-fill)`} />
          <path
            d={NET_WORTH_LINE}
            fill="none"
            stroke={`url(#${id}-line)`}
            strokeWidth="3"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      <div className={cn(PAPER, "absolute -right-4 bottom-0 w-56 p-4 sm:-right-8")}>
        <div className="flex items-baseline justify-between">
          <p className="text-xs text-[#5f5f6e]">This month</p>
          <p className="text-sm font-medium tabular-nums">£1,930.36</p>
        </div>
        <div className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full">
          {SPENDING.map((item) => (
            <span
              key={item.name}
              style={{ width: `${item.share}%`, backgroundColor: item.color }}
            />
          ))}
        </div>
        <ul className="mt-3 space-y-1.5 text-xs">
          {SPENDING.slice(0, 3).map((item) => (
            <li key={item.name} className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                {item.name}
              </span>
              <span className="text-[#5f5f6e] tabular-nums">{item.share}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
