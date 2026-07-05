import {
  categoryRules,
  financialTransactions,
  transactionCategoryOverrides,
} from "@spark/db/schema";
import { describe, expect, it } from "vitest";
import type { CategoriesService } from "./categories.service";
import type { MerchantsService } from "./merchants.service";
import { EnrichmentService, type EnrichableTransaction } from "./enrichment.service";

interface FakeState {
  overrides: Array<{ transactionId: string; category: string }>;
  rules: Array<{
    id: string;
    matchers: Record<string, unknown>;
    category: string;
    priority: number;
    createdAt: Date;
  }>;
  /** Canonical rows returned by the user-scoped transaction lookup. */
  transactions?: EnrichableTransaction[];
}

interface EnrichmentRow {
  transactionId: string;
  userId: string;
  category: string;
  source: string;
  merchantId: string | null;
}

/**
 * Minimal drizzle stand-in: dispatches on the table object, emulates the
 * enrichment upsert (keyed map, so idempotency is observable), the
 * user-scoped transaction lookup, and the override delete.
 */
function fakeDb(state: FakeState) {
  const enrichments = new Map<string, EnrichmentRow>();

  const db = {
    transaction: <T>(fn: (tx: unknown) => Promise<T>) => fn(db),
    select: () => ({
      from: (table: unknown) => ({
        where: () => {
          if (table === transactionCategoryOverrides) return Promise.resolve([...state.overrides]);
          if (table === categoryRules) return Promise.resolve([...state.rules]);
          return Promise.resolve([]);
        },
        innerJoin: () => ({
          where: () => ({
            limit: () => {
              if (table === financialTransactions) {
                return Promise.resolve([...(state.transactions ?? [])]);
              }
              return Promise.resolve([]);
            },
          }),
        }),
      }),
    }),
    delete: (table: unknown) => ({
      where: () => {
        if (table === transactionCategoryOverrides) {
          state.overrides.length = 0;
        }
        return Promise.resolve();
      },
    }),
    insert: () => ({
      values: (rows: EnrichmentRow[]) => ({
        onConflictDoUpdate: () => {
          for (const row of rows) {
            enrichments.set(row.transactionId, row);
          }
          return Promise.resolve();
        },
      }),
    }),
  };

  return { db, enrichments };
}

function transaction(overrides: Partial<EnrichableTransaction> = {}): EnrichableTransaction {
  return {
    id: "txn-1",
    providerId: "truelayer",
    type: "WITHDRAWAL",
    description: "TESCO STORES 3421",
    amount: "-42.50",
    metadata: {
      merchantName: "TESCO STORES",
      transactionCategory: "PURCHASE",
      transactionClassification: ["Food & Dining", "Groceries"],
    },
    ...overrides,
  };
}

function createService(db: unknown = {}, merchantIds = new Map<string, string>()) {
  const categoriesService = {
    assertValidCategoryId: async () => undefined,
  } as unknown as CategoriesService;
  const merchantsService = {
    resolveIds: async () => merchantIds,
  } as unknown as MerchantsService;
  return new EnrichmentService(db as never, categoriesService, merchantsService);
}

describe("EnrichmentService.enrichBatch", () => {
  it("derives the default category and attaches the resolved merchant id", async () => {
    const state: FakeState = { overrides: [], rules: [] };
    const { db, enrichments } = fakeDb(state);
    const service = createService(db, new Map([["tesco stores", "merchant-tesco"]]));

    await service.enrichBatch(db as never, {
      userId: "user-1",
      transactions: [transaction()],
    });

    const row = enrichments.get("txn-1");
    expect(row?.category).toBe("GROCERIES");
    expect(row?.source).toBe("PROVIDER_DEFAULT");
    expect(row?.merchantId).toBe("merchant-tesco");
  });

  it("applies a matching rule over the default (source RULE)", async () => {
    const state: FakeState = {
      overrides: [],
      rules: [
        {
          id: "rule-1",
          matchers: { groups: [[{ field: "MERCHANT", op: "IS", value: "tesco stores" }]] },
          category: "SHOPPING",
          priority: 0,
          createdAt: new Date("2026-01-01T00:00:00Z"),
        },
      ],
    };
    const { db, enrichments } = fakeDb(state);

    await createService(db).enrichBatch(db as never, {
      userId: "user-1",
      transactions: [transaction()],
    });

    expect(enrichments.get("txn-1")?.category).toBe("SHOPPING");
    expect(enrichments.get("txn-1")?.source).toBe("RULE");
  });

  it("lets a user override beat a matching rule", async () => {
    const state: FakeState = {
      overrides: [{ transactionId: "txn-1", category: "EATING_OUT" }],
      rules: [
        {
          id: "rule-1",
          matchers: { groups: [[{ field: "MERCHANT", op: "IS", value: "tesco stores" }]] },
          category: "SHOPPING",
          priority: 100,
          createdAt: new Date("2026-01-01T00:00:00Z"),
        },
      ],
    };
    const { db, enrichments } = fakeDb(state);

    await createService(db).enrichBatch(db as never, {
      userId: "user-1",
      transactions: [transaction()],
    });

    expect(enrichments.get("txn-1")?.category).toBe("EATING_OUT");
    expect(enrichments.get("txn-1")?.source).toBe("USER_OVERRIDE");
  });

  it("is idempotent: re-running produces the same single row per transaction", async () => {
    const state: FakeState = {
      overrides: [{ transactionId: "txn-1", category: "EATING_OUT" }],
      rules: [],
    };
    const { db, enrichments } = fakeDb(state);
    const service = createService(db);
    const input = { userId: "user-1", transactions: [transaction()] };

    await service.enrichBatch(db as never, input);
    const first = enrichments.get("txn-1");
    await service.enrichBatch(db as never, input);
    const second = enrichments.get("txn-1");

    expect(enrichments.size).toBe(1);
    expect(second?.category).toBe(first?.category);
    expect(second?.source).toBe("USER_OVERRIDE");
  });

  it("skips invalid stored rules instead of crashing the sync", async () => {
    const state: FakeState = {
      overrides: [],
      rules: [
        {
          id: "rule-bad",
          matchers: {},
          category: "NOT_A_CATEGORY",
          priority: 0,
          createdAt: new Date(),
        },
      ],
    };
    const { db, enrichments } = fakeDb(state);

    await createService(db).enrichBatch(db as never, {
      userId: "user-1",
      transactions: [transaction()],
    });

    expect(enrichments.get("txn-1")?.source).toBe("PROVIDER_DEFAULT");
  });
});

describe("EnrichmentService.clearCategory", () => {
  it("removes the override and re-derives from a matching rule (reset to automatic)", async () => {
    const state: FakeState = {
      overrides: [{ transactionId: "txn-1", category: "EATING_OUT" }],
      rules: [
        {
          id: "rule-1",
          matchers: { groups: [[{ field: "MERCHANT", op: "IS", value: "tesco stores" }]] },
          category: "SHOPPING",
          priority: 0,
          createdAt: new Date("2026-01-01T00:00:00Z"),
        },
      ],
      transactions: [transaction()],
    };
    const { db } = fakeDb(state);

    const result = await createService(db).clearCategory("user-1", { transactionId: "txn-1" });

    expect(state.overrides).toHaveLength(0);
    expect(result.category).toBe("SHOPPING");
    expect(result.categorySource).toBe("RULE");
  });

  it("falls back to the provider default when no rule matches after the reset", async () => {
    const state: FakeState = {
      overrides: [{ transactionId: "txn-1", category: "EATING_OUT" }],
      rules: [],
      transactions: [transaction()],
    };
    const { db } = fakeDb(state);

    const result = await createService(db).clearCategory("user-1", { transactionId: "txn-1" });

    expect(result.category).toBe("GROCERIES");
    expect(result.categorySource).toBe("PROVIDER_DEFAULT");
  });

  it("rejects a transaction the user does not own", async () => {
    const state: FakeState = { overrides: [], rules: [], transactions: [] };
    const { db } = fakeDb(state);

    await expect(
      createService(db).clearCategory("user-1", { transactionId: "txn-unknown" }),
    ).rejects.toThrow("Transaction not found");
  });
});
