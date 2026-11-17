/** Net-worth chart windows, in days. */
export const SERIES_RANGES = { "1M": 30, "3M": 90, "6M": 182, "1Y": 365 } as const;
export type SeriesRange = keyof typeof SERIES_RANGES;
