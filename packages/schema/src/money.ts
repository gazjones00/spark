import { z } from "zod";

/**
 * Decimal money codec for the provider parse boundary.
 *
 * Monetary values are represented as canonical decimal *strings* from the
 * moment they are parsed, so no further JS float arithmetic can happen on
 * them downstream — they flow untouched into Postgres `numeric(19,4)`
 * columns, which persistence writes verbatim.
 *
 * Known limitation (documented on purpose): when a provider transports an
 * amount as a JSON *number*, the IEEE-754 round-trip has already happened
 * before Zod sees the value — a string codec cannot recover precision that
 * was lost on the wire. What this codec guarantees is that (a) the value is
 * frozen exactly as it arrived (`String(value)`, never re-rounded, so the
 * persisted representation is identical to the previous
 * `value.toString()` behaviour), and (b) the domain type is a string, so
 * accidental arithmetic downstream is a compile-time error rather than a
 * silent precision bug. Prefer string transport where a provider offers it.
 *
 * Scale is deliberately NOT enforced here: destination columns round to
 * their declared scale (`numeric(19,4)` amounts, `numeric(19,8)` fx rates)
 * on insert, exactly as they did before this codec existed. Rejecting
 * over-precision at parse time would turn benign provider precision into
 * sync failures, and per-column scale is the destination's contract, not
 * the parse boundary's.
 */

const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/;

/**
 * Renders a finite number as a plain decimal string, expanding scientific
 * notation (`1e+21`, `1.5e-7`) into digits so the output is always valid
 * for a Postgres `numeric` column.
 */
export function numberToDecimalString(value: number): string {
  if (!Number.isFinite(value)) {
    throw new RangeError(`Cannot convert non-finite number to decimal string: ${value}`);
  }
  const repr = String(value);
  if (!repr.includes("e") && !repr.includes("E")) {
    return repr;
  }
  return expandScientific(repr);
}

function expandScientific(repr: string): string {
  const [rawMantissa = "", rawExponent = "0"] = repr.toLowerCase().split("e");
  const exponent = Number(rawExponent);
  const negative = rawMantissa.startsWith("-");
  const mantissa = negative ? rawMantissa.slice(1) : rawMantissa;
  const [intPart = "", fracPart = ""] = mantissa.split(".");
  const digits = intPart + fracPart;
  // Index of the decimal point within `digits` after applying the exponent.
  const pointIndex = intPart.length + exponent;

  let result: string;
  if (pointIndex <= 0) {
    result = `0.${"0".repeat(-pointIndex)}${digits}`;
  } else if (pointIndex >= digits.length) {
    result = digits + "0".repeat(pointIndex - digits.length);
  } else {
    result = `${digits.slice(0, pointIndex)}.${digits.slice(pointIndex)}`;
  }
  // Trim a trailing "." and redundant trailing zeros in the fraction.
  if (result.includes(".")) {
    result = result.replace(/0+$/, "").replace(/\.$/, "");
  }
  return negative ? `-${result}` : result;
}

/**
 * Accepts a provider number OR string and normalises to a canonical decimal
 * string. Rejects non-finite numbers and non-decimal strings (including
 * scientific notation and leading `+`, which Postgres `numeric` input does
 * not need).
 */
export const DecimalSchema = z.union([z.number(), z.string()]).transform((value, ctx) => {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      ctx.addIssue({ code: "custom", message: "Monetary value must be finite" });
      return z.NEVER;
    }
    return numberToDecimalString(value);
  }
  const trimmed = value.trim();
  if (!DECIMAL_PATTERN.test(trimmed)) {
    ctx.addIssue({ code: "custom", message: `Invalid decimal string: "${value}"` });
    return z.NEVER;
  }
  return trimmed;
});

/** Canonical decimal string, e.g. "1234.5678" or "-0.25". */
export type DecimalString = z.infer<typeof DecimalSchema>;
