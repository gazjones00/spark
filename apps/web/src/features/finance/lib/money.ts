const formatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: string, options: Intl.NumberFormatOptions = {}) {
  const key = `${currency}:${JSON.stringify(options)}`;
  let cached = formatters.get(key);
  if (!cached) {
    cached = new Intl.NumberFormat("en-GB", { style: "currency", currency, ...options });
    formatters.set(key, cached);
  }
  return cached;
}

/** £1,234.56 (or −£1,234.56). */
export function formatMoney(amount: number, currency = "GBP"): string {
  return formatter(currency).format(amount);
}

/** +£1,234.56 for money in, −£1,234.56 for money out: for change and flow figures. */
export function formatSignedMoney(amount: number, currency = "GBP"): string {
  return formatter(currency, { signDisplay: "exceptZero" }).format(amount);
}

/** £12.4k: for chart axes and tight spaces. */
export function formatCompactMoney(amount: number, currency = "GBP"): string {
  return formatter(currency, { notation: "compact", maximumFractionDigits: 1 }).format(amount);
}

/** 12% / −3.4%, relative to a base; undefined when the base is zero. */
export function formatPercentChange(change: number, base: number): string | undefined {
  if (base === 0) return undefined;
  const ratio = change / Math.abs(base);
  return new Intl.NumberFormat("en-GB", {
    style: "percent",
    maximumFractionDigits: Math.abs(ratio) < 0.1 ? 1 : 0,
    signDisplay: "exceptZero",
  }).format(ratio);
}
