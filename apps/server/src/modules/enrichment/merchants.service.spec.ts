import { describe, expect, it } from "vitest";
import { MerchantsService } from "./merchants.service";

interface MerchantRow {
  id: string;
  normalizedName: string;
  displayName: string;
  matchPatterns: string[];
}

/**
 * Minimal drizzle stand-in: the select returns every stored merchant (the
 * service's own name/pattern mapping is what's under test) and the insert
 * emulates the normalized-name unique index.
 */
function fakeDb(merchants: MerchantRow[]) {
  return {
    merchants,
    select: () => ({
      from: () => ({
        where: () => Promise.resolve([...merchants]),
      }),
    }),
    insert: () => ({
      values: (rows: MerchantRow[]) => ({
        onConflictDoNothing: () => {
          for (const row of rows) {
            const exists = merchants.some(
              (merchant) => merchant.normalizedName === row.normalizedName,
            );
            if (!exists) {
              merchants.push(row);
            }
          }
          return Promise.resolve();
        },
      }),
    }),
  };
}

describe("MerchantsService.resolveIds", () => {
  it("lazily creates a merchant from a provider-supplied name", async () => {
    const db = fakeDb([]);

    const resolved = await new MerchantsService().resolveIds(db as never, [
      { normalizedName: "tesco stores", providerName: "TESCO STORES" },
    ]);

    expect(db.merchants).toHaveLength(1);
    expect(db.merchants[0]?.normalizedName).toBe("tesco stores");
    expect(db.merchants[0]?.displayName).toBe("TESCO STORES");
    expect(resolved.get("tesco stores")).toBe(db.merchants[0]?.id);
  });

  it("resolves processor-mangled variants to one merchant via matchPatterns", async () => {
    const db = fakeDb([
      {
        id: "merchant-amazon",
        normalizedName: "amazon.co.uk",
        displayName: "Amazon",
        matchPatterns: ["amzn mktp us"],
      },
    ]);

    const resolved = await new MerchantsService().resolveIds(db as never, [
      { normalizedName: "amzn mktp us", providerName: "AMZN Mktp US*2K4" },
      { normalizedName: "amazon.co.uk", providerName: "AMAZON.CO.UK" },
    ]);

    expect(resolved.get("amzn mktp us")).toBe("merchant-amazon");
    expect(resolved.get("amazon.co.uk")).toBe("merchant-amazon");
    // The pattern-matched variant must not spawn a duplicate merchant.
    expect(db.merchants).toHaveLength(1);
  });

  it("never creates merchants from description-derived names", async () => {
    const db = fakeDb([]);

    const resolved = await new MerchantsService().resolveIds(db as never, [
      { normalizedName: "some corner cafe", providerName: null },
    ]);

    expect(db.merchants).toHaveLength(0);
    expect(resolved.size).toBe(0);
  });
});
