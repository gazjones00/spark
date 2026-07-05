/**
 * Deterministic merchant-string normalizer (deliberately minimal — no fuzzy
 * matching, no external data). Case-folds, strips common payment-processor
 * prefixes and trailing reference codes, collapses whitespace. Idempotent:
 * normalizeMerchant(normalizeMerchant(x)) === normalizeMerchant(x).
 */

/** Processor prefixes that wrap the real merchant name ("PAYPAL *SPOTIFY"). */
const PROCESSOR_PREFIXES = [
  /^paypal\s*\*\s*/,
  /^pp\s*\*\s*/,
  /^sq\s*\*\s*/,
  /^sumup\s*\*?\s*/,
  /^zettle_?\*?\s*/,
  /^izettle\s*\*?\s*/,
  /^sp\s+/,
  /^crv\s*\*\s*/,
  /^gpay\s+/,
  /^apple\s*pay\s+/,
];

/**
 * Trailing junk: `*2K4`-style reference codes, long digit runs, store
 * numbers (`#1234`), and dangling punctuation left behind by the strips.
 */
const TRAILING_JUNK = [/\s*\*\s*[a-z0-9-]*$/, /\s+#\d+$/, /\s+\d{4,}$/, /[\s*,.-]+$/];

export function normalizeMerchant(raw: string): string {
  let value = raw.toLowerCase().trim();

  for (const prefix of PROCESSOR_PREFIXES) {
    const stripped = value.replace(prefix, "");
    if (stripped !== value && stripped.length > 0) {
      value = stripped;
      break;
    }
  }

  // Applied repeatedly so stacked suffixes ("AMZN MKTP US*2K4 1234") all go.
  let previous;
  do {
    previous = value;
    for (const junk of TRAILING_JUNK) {
      const stripped = value.replace(junk, "");
      if (stripped.length > 0) {
        value = stripped;
      }
    }
  } while (value !== previous);

  return value.replace(/\s+/g, " ").trim();
}
