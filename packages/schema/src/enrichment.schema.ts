import { z } from "zod";

/**
 * Canonical spending taxonomy: what money was spent ON, not how it moved.
 * This is Spark's own vocabulary — provider signals (TrueLayer's mechanics
 * enum, connector transaction types) are mapped INTO it by the default
 * mapping in @spark/common, and users can re-map via rules and overrides.
 */
export const SpendingCategory = {
  GROCERIES: "GROCERIES",
  EATING_OUT: "EATING_OUT",
  TRANSPORT: "TRANSPORT",
  HOUSING: "HOUSING",
  UTILITIES: "UTILITIES",
  SUBSCRIPTIONS: "SUBSCRIPTIONS",
  SHOPPING: "SHOPPING",
  ENTERTAINMENT: "ENTERTAINMENT",
  HEALTH: "HEALTH",
  CASH: "CASH",
  INCOME: "INCOME",
  TRANSFERS: "TRANSFERS",
  INVESTING: "INVESTING",
  FEES: "FEES",
  OTHER: "OTHER",
} as const;

export const SpendingCategorySchema = z
  .enum([
    SpendingCategory.GROCERIES,
    SpendingCategory.EATING_OUT,
    SpendingCategory.TRANSPORT,
    SpendingCategory.HOUSING,
    SpendingCategory.UTILITIES,
    SpendingCategory.SUBSCRIPTIONS,
    SpendingCategory.SHOPPING,
    SpendingCategory.ENTERTAINMENT,
    SpendingCategory.HEALTH,
    SpendingCategory.CASH,
    SpendingCategory.INCOME,
    SpendingCategory.TRANSFERS,
    SpendingCategory.INVESTING,
    SpendingCategory.FEES,
    SpendingCategory.OTHER,
  ])
  .meta({ id: "SpendingCategory" });

export type SpendingCategory = z.infer<typeof SpendingCategorySchema>;

/**
 * A category reference: either a built-in {@link SpendingCategory} value or
 * the id of a user-defined category. Shape-validated here; existence and
 * ownership of custom ids are enforced server-side at write time, so stored
 * references can be treated as opaque strings on the read path.
 */
export const CategoryIdSchema = z.string().trim().min(1).max(64).meta({ id: "CategoryId" });

export type CategoryId = z.infer<typeof CategoryIdSchema>;

/** Colour tokens available to user categories (the web app's chart palette). */
export const CategoryColorSchema = z
  .enum(["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"])
  .meta({ id: "CategoryColor" });

export type CategoryColor = z.infer<typeof CategoryColorSchema>;

/**
 * The palette as a value list, derived from the schema — the single source
 * for server-side colour rotation and client swatch pickers, so adding a
 * colour can't leave one consumer out of sync.
 */
export const CATEGORY_COLORS: readonly CategoryColor[] = CategoryColorSchema.options;

/** A user-defined spending category (custom, beyond the built-in taxonomy). */
export const UserCategorySchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(50),
    color: CategoryColorSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: "UserCategory" });

export type UserCategory = z.infer<typeof UserCategorySchema>;

/**
 * Unified display descriptor for pickers and labels: built-in categories
 * (id = enum value) and the user's custom categories (id = uuid) in one
 * list, so the client renders both through one lookup.
 */
export const CategoryDescriptorSchema = z
  .object({
    id: CategoryIdSchema,
    label: z.string(),
    color: z.string(),
    builtIn: z.boolean(),
  })
  .meta({ id: "CategoryDescriptor" });

export type CategoryDescriptor = z.infer<typeof CategoryDescriptorSchema>;

export const ListCategoriesResponseSchema = z
  .object({
    categories: z.array(CategoryDescriptorSchema),
  })
  .meta({ id: "ListCategoriesResponse" });

export type ListCategoriesResponse = z.infer<typeof ListCategoriesResponseSchema>;

export const CreateUserCategoryInputSchema = z
  .object({
    name: z.string().trim().min(1).max(50),
    color: CategoryColorSchema.optional(),
  })
  .meta({ id: "CreateUserCategoryInput" });

export type CreateUserCategoryInput = z.infer<typeof CreateUserCategoryInputSchema>;

export const UpdateUserCategoryInputSchema = z
  .object({
    categoryId: z.uuid(),
    name: z.string().trim().min(1).max(50).optional(),
    color: CategoryColorSchema.optional(),
  })
  .meta({ id: "UpdateUserCategoryInput" });

export type UpdateUserCategoryInput = z.infer<typeof UpdateUserCategoryInputSchema>;

export const DeleteUserCategoryInputSchema = z
  .object({
    categoryId: z.uuid(),
  })
  .meta({ id: "DeleteUserCategoryInput" });

export type DeleteUserCategoryInput = z.infer<typeof DeleteUserCategoryInputSchema>;

export const DeleteUserCategoryResponseSchema = z
  .object({
    deleted: z.boolean(),
  })
  .meta({ id: "DeleteUserCategoryResponse" });

export type DeleteUserCategoryResponse = z.infer<typeof DeleteUserCategoryResponseSchema>;

/** Where a transaction's canonical category came from. Overrides > rules > default. */
export const CategorySource = {
  PROVIDER_DEFAULT: "PROVIDER_DEFAULT",
  RULE: "RULE",
  USER_OVERRIDE: "USER_OVERRIDE",
} as const;

export const CategorySourceSchema = z
  .enum([CategorySource.PROVIDER_DEFAULT, CategorySource.RULE, CategorySource.USER_OVERRIDE])
  .meta({ id: "CategorySource" });

export type CategorySource = z.infer<typeof CategorySourceSchema>;

/** Resolved merchant reference included in enriched transaction output. */
export const MerchantRefSchema = z
  .object({
    id: z.string(),
    displayName: z.string(),
  })
  .meta({ id: "MerchantRef" });

export type MerchantRef = z.infer<typeof MerchantRefSchema>;

/**
 * Rule matchers, expressed in disjunctive normal form: an OR-list of
 * condition groups, each group an AND-list of conditions. This covers
 * arbitrary flat boolean combinations — e.g. "(merchant contains amazon AND
 * description contains aws) OR (merchant contains aws)" — without nested
 * expression trees.
 *
 * Text fields: MERCHANT compares against the normalized merchant name (see
 * normalizeMerchant in @spark/common), DESCRIPTION against the raw
 * description, PROVIDER_CATEGORY against the provider's category/type
 * signal. All text comparison is case-insensitive. AMOUNT compares against
 * the transaction's absolute amount.
 */
export const RuleConditionField = {
  MERCHANT: "MERCHANT",
  DESCRIPTION: "DESCRIPTION",
  PROVIDER_CATEGORY: "PROVIDER_CATEGORY",
  AMOUNT: "AMOUNT",
} as const;

export const RuleTextOperator = {
  IS: "IS",
  CONTAINS: "CONTAINS",
  STARTS_WITH: "STARTS_WITH",
  ENDS_WITH: "ENDS_WITH",
  /** Case-insensitive regular expression (validated at write time). */
  REGEX: "REGEX",
} as const;

export const RuleAmountOperator = {
  EQUALS: "EQUALS",
  AT_LEAST: "AT_LEAST",
  AT_MOST: "AT_MOST",
  /** Inclusive range; requires `valueMax`. */
  BETWEEN: "BETWEEN",
} as const;

export const RuleTextOperatorSchema = z
  .enum([
    RuleTextOperator.IS,
    RuleTextOperator.CONTAINS,
    RuleTextOperator.STARTS_WITH,
    RuleTextOperator.ENDS_WITH,
    RuleTextOperator.REGEX,
  ])
  .meta({ id: "RuleTextOperator" });

export const RuleAmountOperatorSchema = z
  .enum([
    RuleAmountOperator.EQUALS,
    RuleAmountOperator.AT_LEAST,
    RuleAmountOperator.AT_MOST,
    RuleAmountOperator.BETWEEN,
  ])
  .meta({ id: "RuleAmountOperator" });

export type RuleTextOperator = z.infer<typeof RuleTextOperatorSchema>;
export type RuleAmountOperator = z.infer<typeof RuleAmountOperatorSchema>;

export const TextRuleConditionSchema = z
  .object({
    field: z.enum([
      RuleConditionField.MERCHANT,
      RuleConditionField.DESCRIPTION,
      RuleConditionField.PROVIDER_CATEGORY,
    ]),
    op: RuleTextOperatorSchema,
    value: z.string().trim().min(1).max(200),
  })
  .superRefine((condition, ctx) => {
    if (condition.op === RuleTextOperator.REGEX) {
      // Length is capped by the value schema; compile-check here so a bad
      // pattern is rejected at the API boundary, not at enrichment time.
      try {
        new RegExp(condition.value, "iu");
      } catch {
        ctx.addIssue({ code: "custom", message: "Invalid regular expression" });
      }
    }
  })
  .meta({ id: "TextRuleCondition" });

export type TextRuleCondition = z.infer<typeof TextRuleConditionSchema>;

export const AmountRuleConditionSchema = z
  .object({
    field: z.literal(RuleConditionField.AMOUNT),
    op: RuleAmountOperatorSchema,
    value: z.number().nonnegative(),
    /** Upper bound, only for BETWEEN. */
    valueMax: z.number().nonnegative().optional(),
  })
  .superRefine((condition, ctx) => {
    if (condition.op === RuleAmountOperator.BETWEEN) {
      if (condition.valueMax === undefined) {
        ctx.addIssue({ code: "custom", message: "BETWEEN requires valueMax" });
      } else if (condition.valueMax < condition.value) {
        ctx.addIssue({ code: "custom", message: "valueMax must be >= value" });
      }
    }
  })
  .meta({ id: "AmountRuleCondition" });

export type AmountRuleCondition = z.infer<typeof AmountRuleConditionSchema>;

export const RuleConditionSchema = z
  .union([TextRuleConditionSchema, AmountRuleConditionSchema])
  .meta({ id: "RuleCondition" });

export type RuleCondition = z.infer<typeof RuleConditionSchema>;

/** One AND-group of conditions. */
export const RuleConditionGroupSchema = z
  .array(RuleConditionSchema)
  .min(1)
  .max(10)
  .meta({ id: "RuleConditionGroup" });

export type RuleConditionGroup = z.infer<typeof RuleConditionGroupSchema>;

export const RuleMatchersSchema = z
  .object({
    /** OR-combined groups; a rule matches when ANY group's conditions ALL hold. */
    groups: z.array(RuleConditionGroupSchema).min(1).max(10),
  })
  .meta({ id: "RuleMatchers" });

export type RuleMatchers = z.infer<typeof RuleMatchersSchema>;

export const CategoryRuleSchema = z
  .object({
    id: z.uuid(),
    matchers: RuleMatchersSchema,
    category: CategoryIdSchema,
    priority: z.int(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: "CategoryRule" });

export type CategoryRule = z.infer<typeof CategoryRuleSchema>;

export const ListCategoryRulesResponseSchema = z
  .object({
    rules: z.array(CategoryRuleSchema),
  })
  .meta({ id: "ListCategoryRulesResponse" });

export type ListCategoryRulesResponse = z.infer<typeof ListCategoryRulesResponseSchema>;

export const CreateCategoryRuleInputSchema = z
  .object({
    matchers: RuleMatchersSchema,
    category: CategoryIdSchema,
    priority: z.int().min(-1000).max(1000).default(0),
  })
  .meta({ id: "CreateCategoryRuleInput" });

export type CreateCategoryRuleInput = z.infer<typeof CreateCategoryRuleInputSchema>;

export const UpdateCategoryRuleInputSchema = z
  .object({
    ruleId: z.uuid(),
    matchers: RuleMatchersSchema.optional(),
    category: CategoryIdSchema.optional(),
    priority: z.int().min(-1000).max(1000).optional(),
  })
  .meta({ id: "UpdateCategoryRuleInput" });

export type UpdateCategoryRuleInput = z.infer<typeof UpdateCategoryRuleInputSchema>;

export const DeleteCategoryRuleInputSchema = z
  .object({
    ruleId: z.uuid(),
  })
  .meta({ id: "DeleteCategoryRuleInput" });

export type DeleteCategoryRuleInput = z.infer<typeof DeleteCategoryRuleInputSchema>;

export const DeleteCategoryRuleResponseSchema = z
  .object({
    deleted: z.boolean(),
  })
  .meta({ id: "DeleteCategoryRuleResponse" });

export type DeleteCategoryRuleResponse = z.infer<typeof DeleteCategoryRuleResponseSchema>;

export const SetTransactionCategoryInputSchema = z
  .object({
    transactionId: z.string().min(1),
    category: CategoryIdSchema,
  })
  .meta({ id: "SetTransactionCategoryInput" });

export type SetTransactionCategoryInput = z.infer<typeof SetTransactionCategoryInputSchema>;

export const SetTransactionCategoryResponseSchema = z
  .object({
    transactionId: z.string(),
    category: CategoryIdSchema,
    categorySource: CategorySourceSchema,
  })
  .meta({ id: "SetTransactionCategoryResponse" });

export type SetTransactionCategoryResponse = z.infer<typeof SetTransactionCategoryResponseSchema>;

export const ClearTransactionCategoryInputSchema = z
  .object({
    transactionId: z.string().min(1),
  })
  .meta({ id: "ClearTransactionCategoryInput" });

export type ClearTransactionCategoryInput = z.infer<typeof ClearTransactionCategoryInputSchema>;

/** The re-derived (rule or default) category after the override is removed. */
export const ClearTransactionCategoryResponseSchema = z
  .object({
    transactionId: z.string(),
    category: CategoryIdSchema,
    categorySource: CategorySourceSchema,
  })
  .meta({ id: "ClearTransactionCategoryResponse" });

export type ClearTransactionCategoryResponse = z.infer<
  typeof ClearTransactionCategoryResponseSchema
>;
