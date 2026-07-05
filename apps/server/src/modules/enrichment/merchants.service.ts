import { Injectable } from "@nestjs/common";
import { inArray, sql, type DatabaseExecutor } from "@spark/db";
import { merchants } from "@spark/db/schema";

/** One merchant reference to resolve. */
export interface MerchantNameInput {
  /** normalizeMerchant output — the canonical matching key. */
  normalizedName: string;
  /**
   * Raw provider merchant string, when the provider supplied one; null for
   * names derived from a transaction description.
   */
  providerName: string | null;
}

/**
 * Resolves normalized merchant names to merchant ids: exact match on
 * `normalizedName` or membership of `matchPatterns` (so processor-mangled
 * variants resolve to one merchant). Names backed by a provider-supplied
 * merchant string that match nothing get a merchant row created lazily;
 * description-derived names only ever match existing merchants, so
 * descriptions can't flood the merchant table.
 */
@Injectable()
export class MerchantsService {
  /** Returns normalized name → merchant id for every name that resolved. */
  async resolveIds(
    db: DatabaseExecutor,
    names: readonly MerchantNameInput[],
  ): Promise<Map<string, string>> {
    /** normalized name → raw provider string (null when description-derived). */
    const providerNames = new Map<string, string | null>();
    for (const { normalizedName, providerName } of names) {
      const trimmed = providerName?.trim() || null;
      if (!providerNames.has(normalizedName) || trimmed) {
        providerNames.set(normalizedName, trimmed);
      }
    }

    if (providerNames.size === 0) {
      return new Map();
    }

    const nameList = [...providerNames.keys()];
    const byName = new Map<string, string>();

    const loadMatches = async () => {
      const found = await db
        .select({
          id: merchants.id,
          normalizedName: merchants.normalizedName,
          matchPatterns: merchants.matchPatterns,
        })
        .from(merchants)
        .where(
          sql`${inArray(merchants.normalizedName, nameList)} or ${merchants.matchPatterns} ?| ${sql.param(nameList)}::text[]`,
        );
      for (const merchant of found) {
        byName.set(merchant.normalizedName, merchant.id);
        for (const pattern of merchant.matchPatterns) {
          if (providerNames.has(pattern) && !byName.has(pattern)) {
            byName.set(pattern, merchant.id);
          }
        }
      }
    };

    await loadMatches();

    const missing = nameList.filter(
      (name) => !byName.has(name) && providerNames.get(name) !== null,
    );
    if (missing.length > 0) {
      await db
        .insert(merchants)
        .values(
          missing.map((name) => ({
            id: crypto.randomUUID(),
            normalizedName: name,
            displayName: providerNames.get(name) ?? name,
            matchPatterns: [],
          })),
        )
        .onConflictDoNothing({ target: merchants.normalizedName });
      // Re-select instead of trusting returning(): a concurrent insert may
      // have won the conflict, and its id is the one to use.
      await loadMatches();
    }

    return byName;
  }
}
