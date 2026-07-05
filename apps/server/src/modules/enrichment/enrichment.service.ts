import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { mapDefaultSpendingCategory, normalizeMerchant } from "@spark/common";
import { and, eq, inArray, sql, type Database, type DatabaseExecutor } from "@spark/db";
import {
  categoryRules,
  financialAccounts,
  financialTransactions,
  transactionCategoryOverrides,
  transactionEnrichments,
} from "@spark/db/schema";
import {
  CategorySource,
  RuleMatchersSchema,
  type CategoryId,
  type ClearTransactionCategoryInput,
  type ClearTransactionCategoryResponse,
  type SetTransactionCategoryInput,
  type SetTransactionCategoryResponse,
} from "@spark/schema";
import { CategoriesService } from "./categories.service";
import { MerchantsService, type MerchantNameInput } from "./merchants.service";
import { DATABASE_CONNECTION } from "../database";
import {
  compileRule,
  selectRule,
  type CompiledRule,
  type RuleEvaluationContext,
} from "./rule-engine";

/** The canonical-row slice enrichment derives from. Provider data is input only. */
export interface EnrichableTransaction {
  id: string;
  providerId: string;
  type: string;
  description: string;
  amount: string;
  metadata: Record<string, unknown>;
}

export interface EnrichBatchInput {
  userId: string;
  transactions: EnrichableTransaction[];
}

/** One derived enrichment row, as upserted (and returned to the caller). */
export interface DerivedEnrichment {
  transactionId: string;
  userId: string;
  category: CategoryId;
  source: CategorySource;
  merchantId: string | null;
  derivedAt: Date;
}

/**
 * Derives the enrichment layer (canonical category + source + merchant) for
 * canonical transactions and upserts it into `transaction_enrichments`,
 * keyed by transaction id — idempotent by construction, and never touching
 * provider tables.
 *
 * Precedence: USER_OVERRIDE > RULE (see selectRule) > PROVIDER_DEFAULT
 * mapping.
 */
@Injectable()
export class EnrichmentService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly categoriesService: CategoriesService,
    private readonly merchantsService: MerchantsService,
  ) {}

  /**
   * Enriches a batch inside the caller's unit of work (the sync transaction
   * or the re-application job) and returns the derived rows. Deterministic:
   * same rows + rules + overrides always derive the same enrichment.
   *
   * `preloadedRules` lets a caller that pages through many batches (the
   * re-application job) load the rule set once instead of per page.
   */
  async enrichBatch(
    db: DatabaseExecutor,
    input: EnrichBatchInput,
    preloadedRules?: CompiledRule[],
  ): Promise<DerivedEnrichment[]> {
    if (input.transactions.length === 0) {
      return [];
    }

    const contexts = new Map(
      input.transactions.map((transaction) => [transaction.id, buildContext(transaction)]),
    );
    const [merchantIdByName, overrides, rules] = await Promise.all([
      this.merchantsService.resolveIds(db, merchantNames(input.transactions, contexts)),
      this.loadOverrides(db, input),
      preloadedRules ?? this.loadRules(db, input.userId),
    ]);
    const now = new Date();

    const rows = input.transactions.map((transaction): DerivedEnrichment => {
      const context = contexts.get(transaction.id)!;
      const merchantId = context.normalizedMerchant
        ? (merchantIdByName.get(context.normalizedMerchant) ?? null)
        : null;

      const override = overrides.get(transaction.id);
      let category: CategoryId;
      let source: CategorySource;
      if (override) {
        category = override;
        source = CategorySource.USER_OVERRIDE;
      } else {
        const rule = selectRule(rules, context);
        if (rule) {
          category = rule.category;
          source = CategorySource.RULE;
        } else {
          category = defaultCategory(transaction);
          source = CategorySource.PROVIDER_DEFAULT;
        }
      }

      return {
        transactionId: transaction.id,
        userId: input.userId,
        category,
        source,
        merchantId,
        derivedAt: now,
      };
    });

    await db
      .insert(transactionEnrichments)
      .values(rows)
      .onConflictDoUpdate({
        target: transactionEnrichments.transactionId,
        set: {
          userId: sql`excluded.user_id`,
          category: sql`excluded.category`,
          source: sql`excluded.source`,
          merchantId: sql`excluded.merchant_id`,
          derivedAt: now,
        },
      });

    return rows;
  }

  /**
   * Per-transaction user override: stored in its own table so the
   * sync path's provider-row upserts can never clobber it, then re-derived
   * immediately so reads reflect the edit without waiting for a sync.
   */
  async setCategory(
    userId: string,
    input: SetTransactionCategoryInput,
  ): Promise<SetTransactionCategoryResponse> {
    const transaction = await this.loadUserTransaction(userId, input.transactionId);
    if (!transaction) {
      throw new NotFoundException("Transaction not found");
    }

    await this.db.transaction(async (tx) => {
      // Validate under the category-refs lock so the referenced custom
      // category can't be deleted before this override commits.
      await this.categoriesService.lockCategoryReferences(tx, userId);
      await this.categoriesService.assertValidCategoryId(userId, input.category, tx);

      await tx
        .insert(transactionCategoryOverrides)
        .values({
          id: crypto.randomUUID(),
          userId,
          transactionId: transaction.id,
          category: input.category,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: transactionCategoryOverrides.transactionId,
          set: { category: input.category, updatedAt: new Date() },
        });

      await this.enrichBatch(tx, { userId, transactions: [transaction] });
    });

    return {
      transactionId: transaction.id,
      category: input.category,
      categorySource: CategorySource.USER_OVERRIDE,
    };
  }

  /**
   * Removes a per-transaction override ("reset to automatic") and re-derives
   * enrichment immediately, so the transaction is governed by rules/defaults
   * again. Returns the re-derived category so the client can render it
   * without a refetch.
   */
  async clearCategory(
    userId: string,
    input: ClearTransactionCategoryInput,
  ): Promise<ClearTransactionCategoryResponse> {
    const transaction = await this.loadUserTransaction(userId, input.transactionId);
    if (!transaction) {
      throw new NotFoundException("Transaction not found");
    }

    const derived = await this.db.transaction(async (tx) => {
      await tx
        .delete(transactionCategoryOverrides)
        .where(
          and(
            eq(transactionCategoryOverrides.userId, userId),
            eq(transactionCategoryOverrides.transactionId, transaction.id),
          ),
        );

      const rows = await this.enrichBatch(tx, { userId, transactions: [transaction] });
      return rows[0]!;
    });

    return {
      transactionId: transaction.id,
      category: derived.category,
      categorySource: derived.source,
    };
  }

  /**
   * Pages through a user's full history re-deriving enrichment — the body of
   * the re-application job. Idempotent: converges to the same state however
   * often it runs.
   */
  async reapplyForUser(userId: string, batchSize = 500): Promise<number> {
    let lastId = "";
    let processed = 0;

    // The rule set can't change mid-run (a concurrent rule edit enqueues a
    // fresh job that converges the state anyway), so load it once instead of
    // once per page.
    const rules = await this.loadRules(this.db, userId);

    for (;;) {
      const rows = await this.db
        .select({
          id: financialTransactions.id,
          providerId: financialTransactions.providerId,
          type: financialTransactions.type,
          description: financialTransactions.description,
          amount: financialTransactions.amount,
          metadata: financialTransactions.metadata,
        })
        .from(financialTransactions)
        .innerJoin(
          financialAccounts,
          and(
            eq(financialTransactions.connectionId, financialAccounts.connectionId),
            eq(financialTransactions.accountExternalId, financialAccounts.externalId),
          ),
        )
        .where(
          and(eq(financialAccounts.userId, userId), sql`${financialTransactions.id} > ${lastId}`),
        )
        .orderBy(financialTransactions.id)
        .limit(batchSize);

      if (rows.length === 0) {
        return processed;
      }

      await this.enrichBatch(this.db, { userId, transactions: rows }, rules);
      processed += rows.length;
      lastId = rows.at(-1)!.id;
    }
  }

  /** Loads one canonical transaction scoped to the owning user, or null. */
  private async loadUserTransaction(
    userId: string,
    transactionId: string,
  ): Promise<EnrichableTransaction | null> {
    const rows = await this.db
      .select({
        id: financialTransactions.id,
        providerId: financialTransactions.providerId,
        type: financialTransactions.type,
        description: financialTransactions.description,
        amount: financialTransactions.amount,
        metadata: financialTransactions.metadata,
      })
      .from(financialTransactions)
      .innerJoin(
        financialAccounts,
        and(
          eq(financialTransactions.connectionId, financialAccounts.connectionId),
          eq(financialTransactions.accountExternalId, financialAccounts.externalId),
        ),
      )
      .where(and(eq(financialTransactions.id, transactionId), eq(financialAccounts.userId, userId)))
      .limit(1);

    return rows.at(0) ?? null;
  }

  private async loadOverrides(
    db: DatabaseExecutor,
    input: EnrichBatchInput,
  ): Promise<Map<string, CategoryId>> {
    const rows = await db
      .select({
        transactionId: transactionCategoryOverrides.transactionId,
        category: transactionCategoryOverrides.category,
      })
      .from(transactionCategoryOverrides)
      .where(
        and(
          eq(transactionCategoryOverrides.userId, input.userId),
          inArray(
            transactionCategoryOverrides.transactionId,
            input.transactions.map((transaction) => transaction.id),
          ),
        ),
      );

    // Category references (built-in value or custom category id) were
    // validated at write time; treat them as opaque here.
    return new Map(rows.map((row) => [row.transactionId, row.category]));
  }

  private async loadRules(db: DatabaseExecutor, userId: string): Promise<CompiledRule[]> {
    const rows = await db
      .select({
        id: categoryRules.id,
        matchers: categoryRules.matchers,
        category: categoryRules.category,
        priority: categoryRules.priority,
        createdAt: categoryRules.createdAt,
      })
      .from(categoryRules)
      .where(eq(categoryRules.userId, userId));

    const rules: CompiledRule[] = [];
    for (const row of rows) {
      // Stored matchers are re-validated on read so a manually edited row
      // degrades to "rule skipped", not a crashed sync.
      const matchers = RuleMatchersSchema.safeParse(row.matchers);
      if (matchers.success) {
        rules.push(compileRule({ ...row, matchers: matchers.data }));
      }
    }
    return rules;
  }
}

/** Raw provider merchant string, when the provider supplied one. */
function providerMerchantName(transaction: EnrichableTransaction): string | null {
  const value = transaction.metadata.merchantName;
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function buildContext(transaction: EnrichableTransaction): RuleEvaluationContext {
  const raw = providerMerchantName(transaction);
  const normalized = normalizeMerchant(raw ?? transaction.description);
  const providerCategory =
    typeof transaction.metadata.transactionCategory === "string"
      ? transaction.metadata.transactionCategory
      : transaction.type;

  return {
    normalizedMerchant: normalized.length > 0 ? normalized : null,
    description: transaction.description,
    // A malformed canonical amount becomes NaN, which fails every amount
    // comparison — safer than coercing to 0, which would match AT_MOST /
    // zero-bound rules.
    amountAbs: Math.abs(Number(transaction.amount)),
    providerCategory,
  };
}

function merchantNames(
  transactions: EnrichableTransaction[],
  contexts: Map<string, RuleEvaluationContext>,
): MerchantNameInput[] {
  const names: MerchantNameInput[] = [];
  for (const transaction of transactions) {
    const normalizedName = contexts.get(transaction.id)!.normalizedMerchant;
    if (normalizedName) {
      names.push({ normalizedName, providerName: providerMerchantName(transaction) });
    }
  }
  return names;
}

function defaultCategory(transaction: EnrichableTransaction): CategoryId {
  return mapDefaultSpendingCategory({
    providerId: transaction.providerId,
    providerCategory:
      typeof transaction.metadata.transactionCategory === "string"
        ? transaction.metadata.transactionCategory
        : null,
    providerClassification: Array.isArray(transaction.metadata.transactionClassification)
      ? (transaction.metadata.transactionClassification as string[])
      : null,
    providerType: transaction.type,
  });
}
