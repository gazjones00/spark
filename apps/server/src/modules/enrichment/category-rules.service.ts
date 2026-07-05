import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { and, desc, eq, type Database } from "@spark/db";
import { categoryRules } from "@spark/db/schema";
import {
  RuleMatchersSchema,
  type CategoryRule,
  type CreateCategoryRuleInput,
  type DeleteCategoryRuleInput,
  type DeleteCategoryRuleResponse,
  type ListCategoryRulesResponse,
  type UpdateCategoryRuleInput,
} from "@spark/schema";
import { CategoriesService } from "./categories.service";
import { DATABASE_CONNECTION } from "../database";
import { Jobs, MessageQueue, MessageQueueService } from "../message-queue";

/**
 * Per-user categorization rules. Every mutation enqueues the asynchronous
 * re-application job so history converges in the background, never on the
 * request path.
 */
@Injectable()
export class CategoryRulesService {
  private readonly logger = new Logger(CategoryRulesService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    @Inject(`QUEUE_${MessageQueue.DEFAULT}`) private readonly queue: MessageQueueService,
    private readonly categoriesService: CategoriesService,
  ) {}

  async list(userId: string): Promise<ListCategoryRulesResponse> {
    const rows = await this.db
      .select()
      .from(categoryRules)
      .where(eq(categoryRules.userId, userId))
      .orderBy(desc(categoryRules.priority), desc(categoryRules.createdAt));

    // A row whose stored matchers can't be coerced (hand-edited JSON) is
    // omitted rather than failing the whole list.
    return {
      rules: rows.map((row) => toCategoryRule(row)).filter((rule) => rule !== null),
    };
  }

  async create(userId: string, input: CreateCategoryRuleInput): Promise<CategoryRule> {
    await this.categoriesService.assertValidCategoryId(userId, input.category);
    const now = new Date();
    const rows = await this.db
      .insert(categoryRules)
      .values({
        id: crypto.randomUUID(),
        userId,
        matchers: input.matchers,
        category: input.category,
        priority: input.priority,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await this.enqueueReapply(userId);
    return toCategoryRuleOrThrow(rows[0]!);
  }

  async update(userId: string, input: UpdateCategoryRuleInput): Promise<CategoryRule> {
    if (input.category !== undefined) {
      await this.categoriesService.assertValidCategoryId(userId, input.category);
    }
    const rows = await this.db
      .update(categoryRules)
      .set({
        ...(input.matchers !== undefined ? { matchers: input.matchers } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(categoryRules.id, input.ruleId), eq(categoryRules.userId, userId)))
      .returning();

    const row = rows.at(0);
    if (!row) {
      throw new NotFoundException("Rule not found");
    }

    await this.enqueueReapply(userId);
    return toCategoryRuleOrThrow(row);
  }

  async delete(
    userId: string,
    input: DeleteCategoryRuleInput,
  ): Promise<DeleteCategoryRuleResponse> {
    const rows = await this.db
      .delete(categoryRules)
      .where(and(eq(categoryRules.id, input.ruleId), eq(categoryRules.userId, userId)))
      .returning({ id: categoryRules.id });

    if (rows.length > 0) {
      await this.enqueueReapply(userId);
    }
    return { deleted: rows.length > 0 };
  }

  private async enqueueReapply(userId: string): Promise<void> {
    await this.queue.add(Jobs.EnrichmentReapply, { userId });
    this.logger.log({ event: "enrichment.reapply.enqueued", userId });
  }
}

function toCategoryRule(row: typeof categoryRules.$inferSelect): CategoryRule | null {
  const matchers = RuleMatchersSchema.safeParse(row.matchers);
  if (!matchers.success) {
    return null;
  }
  return {
    id: row.id,
    matchers: matchers.data,
    category: row.category,
    priority: row.priority,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** For rows we just wrote from validated input — a parse failure is a bug. */
function toCategoryRuleOrThrow(row: typeof categoryRules.$inferSelect): CategoryRule {
  const rule = toCategoryRule(row);
  if (!rule) {
    throw new Error(`Stored rule ${row.id} has invalid matchers`);
  }
  return rule;
}
