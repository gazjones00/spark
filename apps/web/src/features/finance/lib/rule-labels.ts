import { RuleAmountOperatorSchema, RuleTextOperatorSchema } from "@spark/orpc/contract";
import type { RuleAmountOperator, RuleCondition, RuleTextOperator } from "@spark/orpc/contract";

/**
 * Display labels for the rule schema enums, shared by the editor and the
 * list. Maps are keyed by the schema types, so adding an enum member without
 * a label is a compile error rather than a blank option.
 */

export const fieldLabels: Record<RuleCondition["field"], string> = {
  MERCHANT: "Merchant",
  DESCRIPTION: "Description",
  PROVIDER_CATEGORY: "Provider category",
  AMOUNT: "Amount",
};

export const textOperatorLabels: Record<RuleTextOperator, string> = {
  IS: "is",
  CONTAINS: "contains",
  STARTS_WITH: "starts with",
  ENDS_WITH: "ends with",
  REGEX: "matches regex",
};

export const amountOperatorLabels: Record<RuleAmountOperator, string> = {
  EQUALS: "equals",
  AT_LEAST: "is at least",
  AT_MOST: "is at most",
  BETWEEN: "is between",
};

/** Select options derived from the schema enums, so the two can't drift. */
export const textOperatorOptions = RuleTextOperatorSchema.options.map((value) => ({
  value,
  label: textOperatorLabels[value],
}));

export const amountOperatorOptions = RuleAmountOperatorSchema.options.map((value) => ({
  value,
  label: amountOperatorLabels[value],
}));
