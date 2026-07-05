import { describe, expect, it } from "vitest";
import { RuleMatchersSchema } from "./enrichment.schema.ts";

describe("RuleMatchersSchema", () => {
  it("accepts OR-of-AND groups with mixed operators", () => {
    const result = RuleMatchersSchema.safeParse({
      groups: [
        [
          { field: "MERCHANT", op: "CONTAINS", value: "amazon" },
          { field: "DESCRIPTION", op: "CONTAINS", value: "aws" },
        ],
        [{ field: "MERCHANT", op: "CONTAINS", value: "aws" }],
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid regular expression at the boundary", () => {
    const result = RuleMatchersSchema.safeParse({
      groups: [[{ field: "DESCRIPTION", op: "REGEX", value: "(unclosed" }]],
    });
    expect(result.success).toBe(false);
  });

  it("rejects BETWEEN without an upper bound, or with an inverted range", () => {
    expect(
      RuleMatchersSchema.safeParse({
        groups: [[{ field: "AMOUNT", op: "BETWEEN", value: 10 }]],
      }).success,
    ).toBe(false);
    expect(
      RuleMatchersSchema.safeParse({
        groups: [[{ field: "AMOUNT", op: "BETWEEN", value: 10, valueMax: 5 }]],
      }).success,
    ).toBe(false);
  });

  it("rejects empty groups", () => {
    expect(RuleMatchersSchema.safeParse({ groups: [] }).success).toBe(false);
    expect(RuleMatchersSchema.safeParse({ groups: [[]] }).success).toBe(false);
  });
});
