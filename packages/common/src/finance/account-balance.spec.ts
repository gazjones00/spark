import { describe, expect, it } from "vitest";

import { isLiabilityAccountType, signedAccountBalance } from "./account-balance.ts";

describe("isLiabilityAccountType", () => {
  it("treats cards as liabilities and everything else as assets", () => {
    expect(isLiabilityAccountType("CARD")).toBe(true);
    expect(isLiabilityAccountType("CASH")).toBe(false);
    expect(isLiabilityAccountType("SAVINGS")).toBe(false);
    expect(isLiabilityAccountType("INVEST")).toBe(false);
    expect(isLiabilityAccountType("UNKNOWN")).toBe(false);
  });
});

describe("signedAccountBalance", () => {
  it("keeps asset balances as-is", () => {
    expect(signedAccountBalance("CASH", "1000.50")).toBe(1000.5);
    expect(signedAccountBalance("SAVINGS", "-25")).toBe(-25);
  });

  it("negates card balances (amount owed)", () => {
    expect(signedAccountBalance("CARD", "250.00")).toBe(-250);
  });

  it("turns an overpaid card (negative balance) into an asset", () => {
    expect(signedAccountBalance("CARD", "-50.00")).toBe(50);
  });

  it("treats null and malformed balances as 0", () => {
    expect(signedAccountBalance("CASH", null)).toBe(0);
    expect(signedAccountBalance("CARD", null)).toBe(0);
    expect(signedAccountBalance("CASH", "not-a-number")).toBe(0);
  });
});
