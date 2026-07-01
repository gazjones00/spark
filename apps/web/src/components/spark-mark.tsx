import { cn } from "@/lib/utils";

/**
 * Spark logo mark — a sparkline zigzag that doubles as a spark/bolt.
 * Inherits `currentColor` unless a text color class sets otherwise;
 * pass `accent` to render the canonical orange.
 */
export function SparkMark({ className, accent = true }: { className?: string; accent?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn("size-5 shrink-0", accent && "text-primary", className)}
    >
      <polyline
        points="1.5,15 6.5,15 9.5,5.5 14,19.5 17,10.5 19,13.5 22.5,13.5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
