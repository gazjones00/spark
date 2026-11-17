import { cn } from "@/lib/utils";

/*
 * Spark's signature line art: one line per account, arriving from every
 * direction and filleting into a single tight bundle — every account, one
 * clear picture. Drawn on a 1440×900 canvas with the bundle at x≈1030–1118.
 */
const PATHS = [
  "M-40 120 L869.4 302.7 A200 200 0 0 1 1030 498.8 V920",
  "M-40 -10 L920.4 272.5 A168 168 0 0 1 1041 433.7 V920",
  "M230 -20 L962.8 248.3 A136 136 0 0 1 1052 376 V920",
  "M500 -20 L1004.5 225.5 A104 104 0 0 1 1063 319 V920",
  "M760 -20 L1046.5 205.4 A72 72 0 0 1 1074 262 V920",
  "M1085 -20 V920",
  "M1250 -20 L1106.9 209.5 A72 72 0 0 0 1096 247.6 V920",
  "M1480 40 L1159.2 224 A104 104 0 0 0 1107 314.2 V920",
  "M1480 260 L1246.1 273.6 A136 136 0 0 0 1118 409.3 V920",
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
