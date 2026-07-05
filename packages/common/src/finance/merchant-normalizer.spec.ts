import { describe, expect, it } from "vitest";
import { normalizeMerchant } from "./merchant-normalizer.ts";

describe("normalizeMerchant", () => {
  it("case-folds and collapses whitespace", () => {
    expect(normalizeMerchant("  TESCO   STORES  ")).toBe("tesco stores");
  });

  it("strips processor prefixes", () => {
    expect(normalizeMerchant("PAYPAL *SPOTIFY")).toBe("spotify");
    expect(normalizeMerchant("SQ *BLUE BOTTLE COFFEE")).toBe("blue bottle coffee");
    expect(normalizeMerchant("SUMUP  *CORNER CAFE")).toBe("corner cafe");
  });

  it("strips trailing reference codes and store numbers", () => {
    expect(normalizeMerchant("AMZN Mktp US*2K4")).toBe("amzn mktp us");
    expect(normalizeMerchant("TESCO STORES #3421")).toBe("tesco stores");
    expect(normalizeMerchant("UBER   *TRIP-HELP")).toBe("uber");
    expect(normalizeMerchant("SAINSBURYS 100234956")).toBe("sainsburys");
  });

  it("is idempotent: normalize(normalize(x)) === normalize(x)", () => {
    const samples = [
      "PAYPAL *SPOTIFY",
      "AMZN Mktp US*2K4",
      "AMAZON.CO.UK",
      "  TESCO   STORES #3421 ",
      "plain merchant",
    ];
    for (const sample of samples) {
      const once = normalizeMerchant(sample);
      expect(normalizeMerchant(once)).toBe(once);
    }
  });

  it("never strips a merchant down to nothing", () => {
    expect(normalizeMerchant("*")).not.toBe("");
    expect(normalizeMerchant("1234567")).not.toBe("");
  });
});
