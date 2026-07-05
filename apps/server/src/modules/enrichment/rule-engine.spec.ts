import type { RuleCondition, RuleMatchers } from "@spark/schema";
import { describe, expect, it } from "vitest";
import {
  compileRule,
  selectRule,
  type CompiledRule,
  type RuleEvaluationContext,
} from "./rule-engine";

function context(overrides: Partial<RuleEvaluationContext> = {}): RuleEvaluationContext {
  return {
    normalizedMerchant: "tesco stores",
    description: "TESCO STORES 3421",
    amountAbs: 42.5,
    providerCategory: "PURCHASE",
    ...overrides,
  };
}

function rule(
  overrides: Partial<{
    id: string;
    matchers: RuleMatchers;
    category: string;
    priority: number;
    createdAt: Date;
  }> = {},
): CompiledRule {
  return compileRule({
    id: "rule-1",
    matchers: { groups: [[{ field: "MERCHANT", op: "IS", value: "tesco stores" }]] },
    category: "GROCERIES",
    priority: 0,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  });
}

/** Whether a single compiled condition matches the context. */
function conditionMatches(condition: RuleCondition, evalContext: RuleEvaluationContext): boolean {
  return selectRule([rule({ matchers: { groups: [[condition]] } })], evalContext) !== null;
}

function ruleMatches(matchers: RuleMatchers, evalContext: RuleEvaluationContext): boolean {
  return selectRule([rule({ matchers })], evalContext) !== null;
}

describe("text conditions", () => {
  it("IS: exact, case-insensitive", () => {
    expect(
      conditionMatches({ field: "MERCHANT", op: "IS", value: "Tesco Stores" }, context()),
    ).toBe(true);
    expect(conditionMatches({ field: "MERCHANT", op: "IS", value: "tesco" }, context())).toBe(
      false,
    );
  });

  it("CONTAINS / STARTS_WITH / ENDS_WITH on any text field", () => {
    expect(
      conditionMatches({ field: "DESCRIPTION", op: "CONTAINS", value: "tesco" }, context()),
    ).toBe(true);
    expect(
      conditionMatches({ field: "DESCRIPTION", op: "STARTS_WITH", value: "TESCO" }, context()),
    ).toBe(true);
    expect(
      conditionMatches({ field: "DESCRIPTION", op: "ENDS_WITH", value: "3421" }, context()),
    ).toBe(true);
    expect(
      conditionMatches({ field: "MERCHANT", op: "STARTS_WITH", value: "stores" }, context()),
    ).toBe(false);
    expect(
      conditionMatches({ field: "PROVIDER_CATEGORY", op: "CONTAINS", value: "purch" }, context()),
    ).toBe(true);
  });

  it("REGEX: case-insensitive; an invalid stored pattern degrades to non-match", () => {
    expect(
      conditionMatches({ field: "DESCRIPTION", op: "REGEX", value: "^tesco\\s+stores" }, context()),
    ).toBe(true);
    expect(
      conditionMatches({ field: "DESCRIPTION", op: "REGEX", value: "(unclosed" }, context()),
    ).toBe(false);
  });

  it("REGEX: a stored pattern with catastrophic backtracking degrades to non-match", () => {
    // (a+)+$ is exponential against a non-matching subject; the compile-time
    // safety check must refuse to run it rather than stall enrichment.
    expect(
      conditionMatches(
        { field: "DESCRIPTION", op: "REGEX", value: "(a+)+$" },
        context({ description: `${"a".repeat(60)}b` }),
      ),
    ).toBe(false);
  });

  it("never matches a null subject", () => {
    expect(
      conditionMatches(
        { field: "MERCHANT", op: "CONTAINS", value: "x" },
        context({ normalizedMerchant: null }),
      ),
    ).toBe(false);
  });
});

describe("amount conditions", () => {
  it("EQUALS / AT_LEAST / AT_MOST / BETWEEN against the absolute amount", () => {
    expect(conditionMatches({ field: "AMOUNT", op: "EQUALS", value: 42.5 }, context())).toBe(true);
    expect(conditionMatches({ field: "AMOUNT", op: "AT_LEAST", value: 42.5 }, context())).toBe(
      true,
    );
    expect(conditionMatches({ field: "AMOUNT", op: "AT_LEAST", value: 50 }, context())).toBe(false);
    expect(conditionMatches({ field: "AMOUNT", op: "AT_MOST", value: 42.5 }, context())).toBe(true);
    expect(conditionMatches({ field: "AMOUNT", op: "AT_MOST", value: 40 }, context())).toBe(false);
    expect(
      conditionMatches({ field: "AMOUNT", op: "BETWEEN", value: 40, valueMax: 45 }, context()),
    ).toBe(true);
    expect(
      conditionMatches({ field: "AMOUNT", op: "BETWEEN", value: 43, valueMax: 45 }, context()),
    ).toBe(false);
  });
});

describe("matcher groups (OR of AND-groups)", () => {
  it("ANDs conditions within a group", () => {
    const matchers: RuleMatchers = {
      groups: [
        [
          { field: "MERCHANT", op: "IS", value: "tesco stores" },
          { field: "AMOUNT", op: "AT_MOST", value: 100 },
        ],
      ],
    };
    expect(ruleMatches(matchers, context())).toBe(true);
    expect(ruleMatches(matchers, context({ amountAbs: 200 }))).toBe(false);
  });

  it("ORs groups: (merchant contains amazon AND description contains aws) OR (merchant contains aws)", () => {
    const matchers: RuleMatchers = {
      groups: [
        [
          { field: "MERCHANT", op: "CONTAINS", value: "amazon" },
          { field: "DESCRIPTION", op: "CONTAINS", value: "aws" },
        ],
        [{ field: "MERCHANT", op: "CONTAINS", value: "aws" }],
      ],
    };

    expect(
      ruleMatches(
        matchers,
        context({ normalizedMerchant: "amazon web services", description: "AWS EMEA 4821" }),
      ),
    ).toBe(true);
    expect(
      ruleMatches(matchers, context({ normalizedMerchant: "aws emea", description: "irrelevant" })),
    ).toBe(true);
    expect(
      ruleMatches(
        matchers,
        context({ normalizedMerchant: "amazon.co.uk", description: "order 123" }),
      ),
    ).toBe(false);
  });
});

describe("selectRule conflict resolution", () => {
  it("prefers higher priority", () => {
    const low = rule({ id: "low", priority: 0, category: "GROCERIES" });
    const high = rule({ id: "high", priority: 10, category: "SHOPPING" });

    expect(selectRule([low, high], context())?.id).toBe("high");
    expect(selectRule([high, low], context())?.id).toBe("high");
  });

  it("breaks priority ties by match specificity (condition count of the matched group)", () => {
    const broad = rule({ id: "broad" });
    const specific = rule({
      id: "specific",
      matchers: {
        groups: [
          [
            { field: "MERCHANT", op: "IS", value: "tesco stores" },
            { field: "AMOUNT", op: "AT_MOST", value: 100 },
          ],
        ],
      },
    });

    expect(selectRule([broad, specific], context())?.id).toBe("specific");
    expect(selectRule([specific, broad], context())?.id).toBe("specific");
  });

  it("scores specificity from the matched group, not the widest group overall", () => {
    // The two-condition group does NOT match (amount too high), so it must
    // not lend its size to the rule: the one-condition group is what fired,
    // and an actually-matching two-condition rival wins.
    const partial = rule({
      id: "partial",
      matchers: {
        groups: [
          [
            { field: "MERCHANT", op: "IS", value: "tesco stores" },
            { field: "AMOUNT", op: "AT_MOST", value: 10 },
          ],
          [{ field: "MERCHANT", op: "IS", value: "tesco stores" }],
        ],
      },
    });
    const full = rule({
      id: "full",
      matchers: {
        groups: [
          [
            { field: "MERCHANT", op: "IS", value: "tesco stores" },
            { field: "AMOUNT", op: "AT_MOST", value: 100 },
          ],
        ],
      },
    });

    expect(selectRule([partial, full], context())?.id).toBe("full");
  });

  it("breaks specificity ties by recency, then id — a total order", () => {
    const older = rule({ id: "a-older", createdAt: new Date("2026-01-01T00:00:00Z") });
    const newer = rule({ id: "b-newer", createdAt: new Date("2026-06-01T00:00:00Z") });
    expect(selectRule([older, newer], context())?.id).toBe("b-newer");

    const twinA = rule({ id: "aaaa" });
    const twinB = rule({ id: "bbbb" });
    expect(selectRule([twinA, twinB], context())?.id).toBe("aaaa");
    expect(selectRule([twinB, twinA], context())?.id).toBe("aaaa");
  });

  it("is stable across re-runs regardless of input order", () => {
    const rules = [
      rule({ id: "r1", priority: 5 }),
      rule({
        id: "r2",
        priority: 5,
        matchers: {
          groups: [
            [
              { field: "MERCHANT", op: "IS", value: "tesco stores" },
              { field: "AMOUNT", op: "AT_LEAST", value: 1 },
            ],
          ],
        },
      }),
      rule({ id: "r3", priority: 3 }),
    ];
    const first = selectRule(rules, context())?.id;
    const second = selectRule([...rules].reverse(), context())?.id;
    expect(first).toBe("r2");
    expect(second).toBe("r2");
  });

  it("returns null when nothing matches", () => {
    expect(
      selectRule(
        [rule({ matchers: { groups: [[{ field: "MERCHANT", op: "IS", value: "waitrose" }]] } })],
        context(),
      ),
    ).toBeNull();
  });
});
