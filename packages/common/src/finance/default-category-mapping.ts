import { SpendingCategory } from "@spark/schema";

/**
 * Provider signals available when deriving a default canonical category.
 * Everything is optional except providerId: TrueLayer rows carry a mechanics
 * category + classification, connector rows carry only a canonical type.
 */
export interface DefaultCategoryInput {
  providerId: string;
  /** TrueLayer `transactionCategory` (payment mechanics enum). */
  providerCategory?: string | null;
  /** TrueLayer `transactionClassification` ([level1, level2] spending hints). */
  providerClassification?: string[] | null;
  /** Canonical connector transaction type (DEPOSIT, DIVIDEND, BUY, …). */
  providerType?: string | null;
  description?: string | null;
}

/**
 * Keyword → category table for TrueLayer classification strings. Matched
 * case-insensitively by substring; scanned from the MOST specific
 * classification level (last entry) backwards, so ["Food & Dining",
 * "Groceries"] resolves to GROCERIES, not EATING_OUT.
 */
const CLASSIFICATION_KEYWORDS: ReadonlyArray<readonly [string, SpendingCategory]> = [
  ["grocer", SpendingCategory.GROCERIES],
  ["supermarket", SpendingCategory.GROCERIES],
  ["restaurant", SpendingCategory.EATING_OUT],
  ["fast food", SpendingCategory.EATING_OUT],
  ["coffee", SpendingCategory.EATING_OUT],
  ["food & dining", SpendingCategory.EATING_OUT],
  ["food and dining", SpendingCategory.EATING_OUT],
  ["alcohol", SpendingCategory.EATING_OUT],
  ["public transport", SpendingCategory.TRANSPORT],
  ["auto & transport", SpendingCategory.TRANSPORT],
  ["auto and transport", SpendingCategory.TRANSPORT],
  ["gas & fuel", SpendingCategory.TRANSPORT],
  ["fuel", SpendingCategory.TRANSPORT],
  ["parking", SpendingCategory.TRANSPORT],
  ["taxi", SpendingCategory.TRANSPORT],
  ["travel", SpendingCategory.TRANSPORT],
  ["mortgage", SpendingCategory.HOUSING],
  ["rent", SpendingCategory.HOUSING],
  ["home", SpendingCategory.HOUSING],
  ["utilities", SpendingCategory.UTILITIES],
  ["bills", SpendingCategory.UTILITIES],
  ["mobile phone", SpendingCategory.UTILITIES],
  ["internet", SpendingCategory.UTILITIES],
  ["television", SpendingCategory.UTILITIES],
  ["subscription", SpendingCategory.SUBSCRIPTIONS],
  ["streaming", SpendingCategory.SUBSCRIPTIONS],
  ["shopping", SpendingCategory.SHOPPING],
  ["clothing", SpendingCategory.SHOPPING],
  ["electronics", SpendingCategory.SHOPPING],
  ["entertainment", SpendingCategory.ENTERTAINMENT],
  ["movies", SpendingCategory.ENTERTAINMENT],
  ["music", SpendingCategory.ENTERTAINMENT],
  ["health", SpendingCategory.HEALTH],
  ["pharmacy", SpendingCategory.HEALTH],
  ["doctor", SpendingCategory.HEALTH],
  ["fitness", SpendingCategory.HEALTH],
  ["gym", SpendingCategory.HEALTH],
  ["investment", SpendingCategory.INVESTING],
  ["income", SpendingCategory.INCOME],
  ["paycheck", SpendingCategory.INCOME],
  ["salary", SpendingCategory.INCOME],
  ["transfer", SpendingCategory.TRANSFERS],
  ["fees & charges", SpendingCategory.FEES],
  ["fees and charges", SpendingCategory.FEES],
  ["bank fee", SpendingCategory.FEES],
];

/** TrueLayer mechanics enum → default canonical category. */
const TRUELAYER_CATEGORY_DEFAULTS: Readonly<Record<string, SpendingCategory>> = {
  ATM: SpendingCategory.CASH,
  CASH: SpendingCategory.CASH,
  BILL_PAYMENT: SpendingCategory.UTILITIES,
  DIRECT_DEBIT: SpendingCategory.UTILITIES,
  STANDING_ORDER: SpendingCategory.UTILITIES,
  CASHBACK: SpendingCategory.INCOME,
  CREDIT: SpendingCategory.INCOME,
  INTEREST: SpendingCategory.INCOME,
  DIVIDEND: SpendingCategory.INCOME,
  FEE_CHARGE: SpendingCategory.FEES,
  PURCHASE: SpendingCategory.SHOPPING,
  DEBIT: SpendingCategory.SHOPPING,
  TRANSFER: SpendingCategory.TRANSFERS,
  CHEQUE: SpendingCategory.OTHER,
  CORRECTION: SpendingCategory.OTHER,
  OTHER: SpendingCategory.OTHER,
  UNKNOWN: SpendingCategory.OTHER,
};

/** Canonical connector transaction type → default canonical category. */
const CONNECTOR_TYPE_DEFAULTS: Readonly<Record<string, SpendingCategory>> = {
  DIVIDEND: SpendingCategory.INCOME,
  INTEREST: SpendingCategory.INCOME,
  BUY: SpendingCategory.INVESTING,
  SELL: SpendingCategory.INVESTING,
  CORPORATE_ACTION: SpendingCategory.INVESTING,
  FX_CONVERSION: SpendingCategory.INVESTING,
  FEE: SpendingCategory.FEES,
  TAX: SpendingCategory.FEES,
  DEPOSIT: SpendingCategory.TRANSFERS,
  WITHDRAWAL: SpendingCategory.TRANSFERS,
  TRANSFER_IN: SpendingCategory.TRANSFERS,
  TRANSFER_OUT: SpendingCategory.TRANSFERS,
  CASH_ADJUSTMENT: SpendingCategory.TRANSFERS,
  OTHER: SpendingCategory.OTHER,
};

/**
 * Pure, deterministic default mapping from provider signals to the canonical
 * spending taxonomy. Precedence: classification hints (spending semantics)
 * > provider mechanics category > canonical connector type > OTHER.
 * Same input always produces the same output; no I/O, no randomness.
 */
export function mapDefaultSpendingCategory(input: DefaultCategoryInput): SpendingCategory {
  const classification = input.providerClassification ?? [];
  // Most specific classification level first ([level1, level2] → level2).
  for (let index = classification.length - 1; index >= 0; index -= 1) {
    const value = classification[index]?.toLowerCase() ?? "";
    for (const [keyword, category] of CLASSIFICATION_KEYWORDS) {
      if (value.includes(keyword)) {
        return category;
      }
    }
  }

  if (input.providerCategory) {
    const mapped = TRUELAYER_CATEGORY_DEFAULTS[input.providerCategory.toUpperCase()];
    if (mapped) {
      return mapped;
    }
  }

  if (input.providerType) {
    const mapped = CONNECTOR_TYPE_DEFAULTS[input.providerType.toUpperCase()];
    if (mapped) {
      return mapped;
    }
  }

  return SpendingCategory.OTHER;
}
