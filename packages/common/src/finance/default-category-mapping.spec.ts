import { SpendingCategory } from "@spark/schema";
import { describe, expect, it } from "vitest";
import { mapDefaultSpendingCategory } from "./default-category-mapping.ts";

describe("mapDefaultSpendingCategory", () => {
  it("gives a TrueLayer grocery purchase and a Trading 212 dividend distinct categories", () => {
    const grocery = mapDefaultSpendingCategory({
      providerId: "truelayer",
      providerCategory: "PURCHASE",
      providerClassification: ["Food & Dining", "Groceries"],
    });
    const dividend = mapDefaultSpendingCategory({
      providerId: "trading212",
      providerType: "DIVIDEND",
    });

    expect(grocery).toBe(SpendingCategory.GROCERIES);
    expect(dividend).toBe(SpendingCategory.INCOME);
    expect(grocery).not.toBe(dividend);
  });

  it("is deterministic: same input, same output", () => {
    const input = {
      providerId: "truelayer",
      providerCategory: "PURCHASE",
      providerClassification: ["Shopping"],
    };
    expect(mapDefaultSpendingCategory(input)).toBe(mapDefaultSpendingCategory({ ...input }));
  });

  it("prefers the most specific classification level", () => {
    // Level 1 alone would map to EATING_OUT; level 2 wins.
    expect(
      mapDefaultSpendingCategory({
        providerId: "truelayer",
        providerCategory: "PURCHASE",
        providerClassification: ["Food & Dining", "Groceries"],
      }),
    ).toBe(SpendingCategory.GROCERIES);

    expect(
      mapDefaultSpendingCategory({
        providerId: "truelayer",
        providerCategory: "PURCHASE",
        providerClassification: ["Food & Dining"],
      }),
    ).toBe(SpendingCategory.EATING_OUT);
  });

  it.each([
    ["ATM", SpendingCategory.CASH],
    ["CASH", SpendingCategory.CASH],
    ["BILL_PAYMENT", SpendingCategory.UTILITIES],
    ["DIRECT_DEBIT", SpendingCategory.UTILITIES],
    ["STANDING_ORDER", SpendingCategory.UTILITIES],
    ["CASHBACK", SpendingCategory.INCOME],
    ["CREDIT", SpendingCategory.INCOME],
    ["INTEREST", SpendingCategory.INCOME],
    ["DIVIDEND", SpendingCategory.INCOME],
    ["FEE_CHARGE", SpendingCategory.FEES],
    ["PURCHASE", SpendingCategory.SHOPPING],
    ["DEBIT", SpendingCategory.SHOPPING],
    ["TRANSFER", SpendingCategory.TRANSFERS],
    ["CHEQUE", SpendingCategory.OTHER],
    ["CORRECTION", SpendingCategory.OTHER],
    ["OTHER", SpendingCategory.OTHER],
    ["UNKNOWN", SpendingCategory.OTHER],
  ])("maps the full TrueLayer mechanics enum: %s → %s", (providerCategory, expected) => {
    expect(mapDefaultSpendingCategory({ providerId: "truelayer", providerCategory })).toBe(
      expected,
    );
  });

  it.each([
    ["DIVIDEND", SpendingCategory.INCOME],
    ["INTEREST", SpendingCategory.INCOME],
    ["BUY", SpendingCategory.INVESTING],
    ["SELL", SpendingCategory.INVESTING],
    ["CORPORATE_ACTION", SpendingCategory.INVESTING],
    ["FX_CONVERSION", SpendingCategory.INVESTING],
    ["FEE", SpendingCategory.FEES],
    ["TAX", SpendingCategory.FEES],
    ["DEPOSIT", SpendingCategory.TRANSFERS],
    ["WITHDRAWAL", SpendingCategory.TRANSFERS],
    ["TRANSFER_IN", SpendingCategory.TRANSFERS],
    ["TRANSFER_OUT", SpendingCategory.TRANSFERS],
    ["CASH_ADJUSTMENT", SpendingCategory.TRANSFERS],
    ["OTHER", SpendingCategory.OTHER],
  ])("maps the full canonical connector type enum: %s → %s", (providerType, expected) => {
    expect(mapDefaultSpendingCategory({ providerId: "trading212", providerType })).toBe(expected);
  });

  it("falls back to OTHER when no signal matches", () => {
    expect(mapDefaultSpendingCategory({ providerId: "someprovider" })).toBe(SpendingCategory.OTHER);
    expect(
      mapDefaultSpendingCategory({
        providerId: "someprovider",
        providerCategory: "SOMETHING_NEW",
        providerType: "SOMETHING_ELSE",
        providerClassification: ["Completely Unmapped"],
      }),
    ).toBe(SpendingCategory.OTHER);
  });
});
