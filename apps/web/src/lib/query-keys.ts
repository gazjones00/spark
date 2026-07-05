/**
 * Root keys for the query cache, so reads and invalidations can't drift
 * apart on a typo'd literal. Scoped keys extend these positionally, e.g.
 * `[...queryKeys.transactions, { limit }]` — invalidating the root key
 * invalidates every scoped variant under it.
 */
export const queryKeys = {
  accounts: ["accounts"],
  categories: ["categories"],
  rules: ["rules"],
  transactions: ["transactions"],
} as const;
