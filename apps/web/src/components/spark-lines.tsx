import { cn } from "@/lib/utils";

/*
 * Spark's signature line art: one line per account, arriving from every
 * direction and filleting into a single tight bundle — every account, one
 * clear picture. Drawn on a 1440×900 canvas with the bundle at x≈1030–1118;
 * the outer lines start, and the bundle runs on, well beyond the canvas, so an
 * `overflow-visible` placement can carry them to the edges of a larger box.
 */
const PATHS = [
  "M-1400 -153.2 L869.4 302.7 A200 200 0 0 1 1030 498.8 V2400",
  "M-1400 -410.5 L920.4 272.5 A168 168 0 0 1 1041 433.7 V2400",
  "M230 -20 L962.8 248.3 A136 136 0 0 1 1052 376 V2400",
  "M500 -20 L1004.5 225.5 A104 104 0 0 1 1063 319 V2400",
  "M760 -20 L1046.5 205.4 A72 72 0 0 1 1074 262 V2400",
  "M1085 -20 V2400",
  "M1250 -20 L1106.9 209.5 A72 72 0 0 0 1096 247.6 V2400",
  "M2900 -775 L1159.2 224 A104 104 0 0 0 1107 314.2 V2400",
  "M2900 177.4 L1246.1 273.6 A136 136 0 0 0 1118 409.3 V2400",
] as const;

interface SparkLinesProps {
  className?: string;
  /** Draw the lines in on first paint (respects reduced motion). */
  animate?: boolean;
  /** How the canvas fits its box; defaults to covering it from the right. */
  preserveAspectRatio?: string;
}

// The straight line through the middle of the bundle: the one lit filament.
const LIT_INDEX = 5;

/**
 * Decorative; strokes use `currentColor` (default `--lines`) and the lit line
 * uses `--lines-lit`.
 */
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
      {PATHS.map((d, index) =>
        index === LIT_INDEX ? (
          <path
            key={d}
            d={d}
            data-lit=""
            pathLength={1}
            fill="none"
            stroke="var(--lines-lit, currentColor)"
            strokeWidth="2"
          />
        ) : (
          <path key={d} d={d} pathLength={1} fill="none" stroke="currentColor" strokeWidth="1.25" />
        ),
      )}
    </svg>
  );
}
