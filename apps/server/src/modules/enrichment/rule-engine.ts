import {
  isSafeRulePattern,
  type AmountRuleCondition,
  type CategoryId,
  type RuleCondition,
  type RuleMatchers,
  type TextRuleCondition,
} from "@spark/schema";

/**
 * Pure rule evaluation for the enrichment layer. No I/O — the service loads
 * rules and hands them in compiled, so precedence is unit-testable and
 * deterministic.
 *
 * Matchers are in disjunctive normal form: a rule matches when ANY of its
 * groups matches, and a group matches when ALL of its conditions hold.
 */

/** The provider-derived signals a rule is evaluated against. */
export interface RuleEvaluationContext {
  /** Normalized merchant name (normalizeMerchant output), if resolvable. */
  normalizedMerchant: string | null;
  description: string;
  /** Absolute transaction amount. */
  amountAbs: number;
  /** Provider category signal: TrueLayer mechanics enum or connector type. */
  providerCategory: string | null;
}

type Predicate = (context: RuleEvaluationContext) => boolean;

/**
 * A stored rule with its matchers compiled to predicates: regexes and
 * lowercased needles are prepared once per rule load, not once per
 * transaction evaluated.
 */
export interface CompiledRule {
  id: string;
  /** Built-in taxonomy value or custom category id (validated at write time). */
  category: CategoryId;
  priority: number;
  createdAt: Date;
  /** OR-combined AND-groups, mirroring RuleMatchers. */
  groups: ReadonlyArray<readonly Predicate[]>;
}

export function compileRule(rule: {
  id: string;
  category: CategoryId;
  priority: number;
  createdAt: Date;
  matchers: RuleMatchers;
}): CompiledRule {
  return {
    id: rule.id,
    category: rule.category,
    priority: rule.priority,
    createdAt: rule.createdAt,
    groups: rule.matchers.groups.map((group) => group.map(compileCondition)),
  };
}

function compileCondition(condition: RuleCondition): Predicate {
  return condition.field === "AMOUNT"
    ? compileAmountCondition(condition)
    : compileTextCondition(condition);
}

function compileTextCondition(condition: TextRuleCondition): Predicate {
  const subjectOf: (context: RuleEvaluationContext) => string | null =
    condition.field === "MERCHANT"
      ? (context) => context.normalizedMerchant
      : condition.field === "DESCRIPTION"
        ? (context) => context.description
        : (context) => context.providerCategory;

  // A null subject (e.g. no resolvable merchant) never matches.
  const text =
    (matches: (haystack: string) => boolean): Predicate =>
    (context) => {
      const subject = subjectOf(context);
      return subject !== null && matches(subject.toLowerCase());
    };

  const needle = condition.value.toLowerCase();
  switch (condition.op) {
    case "IS":
      return text((haystack) => haystack === needle);
    case "CONTAINS":
      return text((haystack) => haystack.includes(needle));
    case "STARTS_WITH":
      return text((haystack) => haystack.startsWith(needle));
    case "ENDS_WITH":
      return text((haystack) => haystack.endsWith(needle));
    case "REGEX": {
      // Patterns are compile-, length-, and backtracking-complexity-checked
      // at the API boundary; re-check here so a stored pattern that fails any
      // of those (e.g. a hand-edited row) degrades to a non-match instead of
      // stalling enrichment.
      const regex = isSafeRulePattern(condition.value) ? new RegExp(condition.value, "iu") : null;
      return (context) => {
        const subject = subjectOf(context);
        return subject !== null && regex !== null && regex.test(subject);
      };
    }
  }
}

function compileAmountCondition(condition: AmountRuleCondition): Predicate {
  switch (condition.op) {
    case "EQUALS":
      return (context) => context.amountAbs === condition.value;
    case "AT_LEAST":
      return (context) => context.amountAbs >= condition.value;
    case "AT_MOST":
      return (context) => context.amountAbs <= condition.value;
    case "BETWEEN": {
      const max = condition.valueMax;
      return (context) =>
        max !== undefined && context.amountAbs >= condition.value && context.amountAbs <= max;
    }
  }
}

/**
 * Specificity of a match = the condition count of the largest group that
 * matched (the strongest AND-clause that fired); 0 when nothing matched.
 */
function matchSpecificity(rule: CompiledRule, context: RuleEvaluationContext): number {
  let specificity = 0;
  for (const group of rule.groups) {
    if (group.length > specificity && group.every((condition) => condition(context))) {
      specificity = group.length;
    }
  }
  return specificity;
}

/**
 * Deterministic conflict resolution among matching rules (documented order,
 * no hidden tie-breaks): highest priority → most specific match →
 * newest → lowest id (a total order, so re-runs always pick the same rule).
 */
export function selectRule(
  rules: readonly CompiledRule[],
  context: RuleEvaluationContext,
): CompiledRule | null {
  let winner: CompiledRule | null = null;
  let winnerSpecificity = 0;

  for (const rule of rules) {
    const specificity = matchSpecificity(rule, context);
    if (specificity === 0) {
      continue;
    }
    if (winner === null || outranks(rule, specificity, winner, winnerSpecificity)) {
      winner = rule;
      winnerSpecificity = specificity;
    }
  }

  return winner;
}

function outranks(
  a: CompiledRule,
  specificityA: number,
  b: CompiledRule,
  specificityB: number,
): boolean {
  if (a.priority !== b.priority) {
    return a.priority > b.priority;
  }
  if (specificityA !== specificityB) {
    return specificityA > specificityB;
  }
  if (a.createdAt.getTime() !== b.createdAt.getTime()) {
    return a.createdAt.getTime() > b.createdAt.getTime();
  }
  return a.id < b.id;
}
