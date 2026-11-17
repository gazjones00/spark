import * as React from "react";

import { cn } from "@/lib/utils";

/** The spark: a four-point star with a smaller companion, on a 24-unit grid. */
const SPARK_PATH =
  "M10.5 3.5c.7 4.5 3.5 7.3 8 8-4.5.7-7.3 3.5-8 8-.7-4.5-3.5-7.3-8-8 4.5-.7 7.3-3.5 8-8Z";
const COMPANION_PATH =
  "M19 1.75c.25 1.6 1.15 2.5 2.75 2.75-1.6.25-2.5 1.15-2.75 2.75-.25-1.6-1.15-2.5-2.75-2.75 1.6-.25 2.5-1.15 2.75-2.75Z";

/**
 * Spark logo mark. Filled with the spark gradient by default; `mono`
 * renders it in `currentColor` (e.g. white on the gradient app icon).
 */
export function SparkMark({ className, mono = false }: { className?: string; mono?: boolean }) {
  const gradientId = React.useId();
  const fill = mono ? "currentColor" : `url(#${gradientId})`;
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("size-5 shrink-0", className)}>
      {mono ? null : (
        <defs>
          <linearGradient
            id={gradientId}
            x1="2"
            y1="2"
            x2="22"
            y2="22"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#FF9A3C" />
            <stop offset="0.5" stopColor="#FF5470" />
            <stop offset="1" stopColor="#8A5CFF" />
          </linearGradient>
        </defs>
      )}
      <path d={SPARK_PATH} fill={fill} />
      <path d={COMPANION_PATH} fill={fill} />
    </svg>
  );
}

/** Mark + lowercase wordmark, the product's primary lockup. */
export function SparkLogo({
  className,
  markClassName,
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <SparkMark className={cn("size-6", markClassName)} />
      <span className="font-display text-foreground text-[1.3rem] leading-none font-bold tracking-[-0.03em]">
        spark
      </span>
    </span>
  );
}

/** App-icon tile: white spark on the gradient, for avatars and small brand spots. */
export function SparkAppIcon({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "bg-spark-gradient inline-flex size-9 shrink-0 items-center justify-center rounded-[28%] text-white",
        className,
      )}
    >
      <SparkMark mono className="size-[62%]" />
    </span>
  );
}
