import { describe, expect, it } from "vitest";
import { DecimalSchema, numberToDecimalString } from "./money.ts";

describe("numberToDecimalString", () => {
  it("preserves the exact String(value) representation for plain numbers", () => {
    expect(numberToDecimalString(0.1)).toBe("0.1");
    expect(numberToDecimalString(-1234.5678)).toBe("-1234.5678");
    expect(numberToDecimalString(42)).toBe("42");
    expect(numberToDecimalString(0)).toBe("0");
  });

  it("expands scientific notation to digits (no `e` in numeric columns)", () => {
    expect(numberToDecimalString(1e21)).toBe("1000000000000000000000");
    expect(numberToDecimalString(-2.5e21)).toBe("-2500000000000000000000");
    expect(numberToDecimalString(1.5e-7)).toBe("0.00000015");
    expect(numberToDecimalString(-3e-8)).toBe("-0.00000003");
  });

  it("rejects non-finite values", () => {
    expect(() => numberToDecimalString(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => numberToDecimalString(Number.NaN)).toThrow(RangeError);
  });
});

describe("DecimalSchema", () => {
  it("normalises numbers to canonical decimal strings", () => {
    expect(DecimalSchema.parse(10.25)).toBe("10.25");
    expect(DecimalSchema.parse(-0.5)).toBe("-0.5");
    expect(DecimalSchema.parse(1e21)).toBe("1000000000000000000000");
  });

  it("accepts decimal strings (trimmed) and keeps them verbatim", () => {
    expect(DecimalSchema.parse("1234.5678")).toBe("1234.5678");
    expect(DecimalSchema.parse(" -42.0001 ")).toBe("-42.0001");
    expect(DecimalSchema.parse("0")).toBe("0");
  });

  it("rejects garbage, scientific-notation strings, leading +, and non-finite numbers", () => {
    for (const invalid of ["", "abc", "1e5", "+1.5", "1.2.3", "0x10", "1,000"]) {
      expect(DecimalSchema.safeParse(invalid).success, `should reject "${invalid}"`).toBe(false);
    }
    expect(DecimalSchema.safeParse(Number.NaN).success).toBe(false);
    expect(DecimalSchema.safeParse(Number.POSITIVE_INFINITY).success).toBe(false);
  });

  it("composes with nullability wrappers", () => {
    expect(DecimalSchema.nullable().parse(null)).toBeNull();
    expect(DecimalSchema.nullable().parse(9.99)).toBe("9.99");
  });

  it("round-trips large/high-precision values without drift", () => {
    // What reaches Postgres must equal what the provider sent us, exactly.
    expect(DecimalSchema.parse("123456789012345.6789")).toBe("123456789012345.6789");
    expect(DecimalSchema.parse(1234567890.12)).toBe(String(1234567890.12));
  });
});
