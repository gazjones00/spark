import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { builtInCategoryDescriptors, spendingCategoryConfig } from "@spark/common";
import { and, asc, eq, sql, type Database, type DatabaseExecutor } from "@spark/db";
import { categoryRules, transactionCategoryOverrides, userCategories } from "@spark/db/schema";
import {
  CATEGORY_COLORS,
  SpendingCategorySchema,
  type CreateUserCategoryInput,
  type DeleteUserCategoryInput,
  type DeleteUserCategoryResponse,
  type ListCategoriesResponse,
  type UpdateUserCategoryInput,
  type UserCategory,
} from "@spark/schema";
import { DATABASE_CONNECTION } from "../database";
import { Jobs, MessageQueue, MessageQueueService } from "../message-queue";

/** Built-in labels, lowercased, so a custom "groceries" can't shadow one. */
const BUILT_IN_LABELS = new Set(
  Object.values(spendingCategoryConfig).map((config) => config.label.toLowerCase()),
);

/**
 * User-defined categories extending the built-in spending taxonomy. Rules,
 * overrides, and enrichments reference categories by id — either a built-in
 * enum value or a `user_categories` row id — so validation happens here at
 * write time and the read path treats references as opaque strings.
 */
@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    @Inject(`QUEUE_${MessageQueue.DEFAULT}`) private readonly queue: MessageQueueService,
  ) {}

  /** Built-in + custom categories in one display list for pickers/labels. */
  async list(userId: string): Promise<ListCategoriesResponse> {
    const custom = await this.db
      .select()
      .from(userCategories)
      .where(eq(userCategories.userId, userId))
      .orderBy(asc(userCategories.name));

    return {
      categories: [
        ...builtInCategoryDescriptors(),
        ...custom.map((row) => ({
          id: row.id,
          label: row.name,
          color: row.color,
          builtIn: false,
        })),
      ],
    };
  }

  async create(userId: string, input: CreateUserCategoryInput): Promise<UserCategory> {
    const name = input.name.trim();
    const normalizedName = name.toLowerCase();
    this.assertNotBuiltIn(normalizedName);

    const existingCount = await this.db
      .select({ id: userCategories.id })
      .from(userCategories)
      .where(eq(userCategories.userId, userId));

    const now = new Date();
    const rows = await this.db
      .insert(userCategories)
      .values({
        id: crypto.randomUUID(),
        userId,
        name,
        normalizedName,
        // Rotate through the palette so adjacent categories differ by default.
        color: input.color ?? CATEGORY_COLORS[existingCount.length % CATEGORY_COLORS.length]!,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: [userCategories.userId, userCategories.normalizedName] })
      .returning();

    const row = rows.at(0);
    if (!row) {
      throw new ConflictException(`A category named "${name}" already exists`);
    }
    return toUserCategory(row);
  }

  async update(userId: string, input: UpdateUserCategoryInput): Promise<UserCategory> {
    const name = input.name?.trim();
    if (name) {
      this.assertNotBuiltIn(name.toLowerCase());
    }

    let rows;
    try {
      rows = await this.db
        .update(userCategories)
        .set({
          ...(name ? { name, normalizedName: name.toLowerCase() } : {}),
          ...(input.color ? { color: input.color } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(userCategories.id, input.categoryId), eq(userCategories.userId, userId)))
        .returning();
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`A category named "${name}" already exists`);
      }
      throw error;
    }

    const row = rows.at(0);
    if (!row) {
      throw new NotFoundException("Category not found");
    }
    return toUserCategory(row);
  }

  /**
   * Deletion is blocked while rules or overrides reference the category, so
   * stored references never dangle. Stale enrichment rows (derived before an
   * earlier rule change) are converged by the re-application job.
   *
   * The in-use checks and the delete run under the per-user category-refs
   * lock so a concurrent rule/override write can't slip a new reference in
   * between the checks passing and the row disappearing.
   */
  async delete(
    userId: string,
    input: DeleteUserCategoryInput,
  ): Promise<DeleteUserCategoryResponse> {
    const deleted = await this.db.transaction(async (tx) => {
      await this.lockCategoryReferences(tx, userId);

      const referencingRules = await tx
        .select({ id: categoryRules.id })
        .from(categoryRules)
        .where(and(eq(categoryRules.userId, userId), eq(categoryRules.category, input.categoryId)))
        .limit(1);
      if (referencingRules.length > 0) {
        throw new ConflictException(
          "This category is used by a rule. Update or delete the rule first.",
        );
      }

      const referencingOverrides = await tx
        .select({ id: transactionCategoryOverrides.id })
        .from(transactionCategoryOverrides)
        .where(
          and(
            eq(transactionCategoryOverrides.userId, userId),
            eq(transactionCategoryOverrides.category, input.categoryId),
          ),
        )
        .limit(1);
      if (referencingOverrides.length > 0) {
        throw new ConflictException(
          "This category is applied to transactions. Recategorize them first.",
        );
      }

      const rows = await tx
        .delete(userCategories)
        .where(and(eq(userCategories.id, input.categoryId), eq(userCategories.userId, userId)))
        .returning({ id: userCategories.id });
      return rows.length > 0;
    });

    if (deleted) {
      await this.queue.add(Jobs.EnrichmentReapply, { userId });
      this.logger.log({ event: "category.deleted", userId, categoryId: input.categoryId });
    }
    return { deleted };
  }

  /**
   * Serializes a user's category-reference writes (rule/override inserts and
   * updates) against custom-category deletes. `category` columns are
   * polymorphic — built-in enum value or `user_categories` id — so the
   * dangling-reference invariant can't be a foreign key; this transaction-
   * scoped advisory lock enforces it instead. Callers must hold an open
   * transaction and take the lock before validating the reference.
   */
  async lockCategoryReferences(tx: DatabaseExecutor, userId: string): Promise<void> {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext('category-refs'), hashtext(${userId}))`,
    );
  }

  /**
   * Write-time validation for category references: a built-in taxonomy
   * value, or a custom category owned by this user. Pass the executor of a
   * transaction holding the category-refs lock so the validated category
   * can't be deleted before the reference commits.
   */
  async assertValidCategoryId(
    userId: string,
    categoryId: string,
    db: DatabaseExecutor = this.db,
  ): Promise<void> {
    if (SpendingCategorySchema.safeParse(categoryId).success) {
      return;
    }

    const rows = await db
      .select({ id: userCategories.id })
      .from(userCategories)
      .where(and(eq(userCategories.id, categoryId), eq(userCategories.userId, userId)))
      .limit(1);

    if (rows.length === 0) {
      throw new BadRequestException("Unknown category");
    }
  }

  private assertNotBuiltIn(normalizedName: string): void {
    if (BUILT_IN_LABELS.has(normalizedName)) {
      throw new ConflictException(`"${normalizedName}" is a built-in category`);
    }
  }
}

function toUserCategory(row: typeof userCategories.$inferSelect): UserCategory {
  return {
    id: row.id,
    name: row.name,
    color: row.color as UserCategory["color"],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Postgres unique_violation, however deep the driver buried it. */
function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const code = (error as { code?: string }).code;
  const cause = (error as { cause?: unknown }).cause;
  return code === "23505" || (cause !== undefined && isUniqueViolation(cause));
}
