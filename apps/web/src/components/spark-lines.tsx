import { cn } from "@/lib/utils";

/*
 * Spark's signature line art: one line per account, arriving from every
 * direction and filleting into a single tight bundle — every account, one
 * clear picture. Drawn on a 1440×900 canvas with the bundle at x≈1030–1118.
 */
const PATHS = [
  "M-40 210 L876.7 467 A210 210 0 0 1 1030 669.2 V920",
  "M-40 40 L931.4 435.4 A176 176 0 0 1 1041 598.4 V920",
  "M230 -20 L980.5 409.1 A142 142 0 0 1 1052 532.4 V920",
  "M500 -20 L1021.5 387.6 A108 108 0 0 1 1063 472.7 V920",
  "M760 -20 L1058.7 370.1 A74 74 0 0 1 1074 415.1 V920",
  "M1085 -20 V920",
  "M1250 -20 L1100.7 377.4 A74 74 0 0 0 1096 403.4 V920",
  "M1480 40 L1137.9 388.5 A108 108 0 0 0 1107 464.1 V920",
  "M1480 260 L1194 410.1 A142 142 0 0 0 1118 535.8 V920",
] as const;

interface SparkLinesProps {
  className?: string;
  /** Draw the lines in on first paint (respects reduced motion). */
  animate?: boolean;
  /** How the canvas fits its box; defaults to covering it from the right. */
  preserveAspectRatio?: string;
}

/** Decorative; stroke colour comes from `currentColor` (default `--lines`). */
export function SparkLines({
  className,
  animate = false,
  preserveAspectRatio = "xMaxYMid slice",
}: SparkLinesProps) {
  return (
    <svg
      viewBox="0 0 1440 900"
      preserveAspectRatio={preserveAspectRatio}
      aria-hidden="true"
      focusable="false"
      className={cn(
        "pointer-events-none text-(--lines)",
        animate && "animate-lines-draw",
        className,
      )}
    >
      {PATHS.map((d) => (
        <path key={d} d={d} pathLength={1} fill="none" stroke="currentColor" strokeWidth="1.25" />
      ))}
    </svg>
  );
}
