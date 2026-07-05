import { describe, expect, it, vi } from "vitest";
import { Jobs } from "../message-queue";
import type { CategoriesService } from "./categories.service";
import { CategoryRulesService } from "./category-rules.service";

function createService() {
  const insertedRules: Record<string, unknown>[] = [];

  const db = {
    insert: () => ({
      values: (row: Record<string, unknown>) => ({
        returning: () => {
          insertedRules.push(row);
          return Promise.resolve([row]);
        },
      }),
    }),
    delete: () => ({
      where: () => ({
        returning: () => Promise.resolve([]),
      }),
    }),
  };

  const queue = { add: vi.fn(async () => undefined) };
  const categoriesService = {
    assertValidCategoryId: vi.fn(async () => undefined),
  };

  const service = new CategoryRulesService(
    db as never,
    queue as never,
    categoriesService as unknown as CategoriesService,
  );

  return { service, queue, insertedRules, categoriesService };
}

describe("CategoryRulesService", () => {
  it("create persists the rule and enqueues the re-application job", async () => {
    const { service, queue, insertedRules } = createService();

    const rule = await service.create("user-1", {
      matchers: { groups: [[{ field: "MERCHANT", op: "IS", value: "tesco stores" }]] },
      category: "GROCERIES",
      priority: 0,
    });

    expect(insertedRules).toHaveLength(1);
    expect(rule.category).toBe("GROCERIES");
    expect(queue.add).toHaveBeenCalledWith(Jobs.EnrichmentReapply, { userId: "user-1" });
  });

  it("validates the target category before persisting", async () => {
    const { service, categoriesService } = createService();

    await service.create("user-1", {
      matchers: { groups: [[{ field: "MERCHANT", op: "IS", value: "tesco stores" }]] },
      category: "GROCERIES",
      priority: 0,
    });

    expect(categoriesService.assertValidCategoryId).toHaveBeenCalledWith("user-1", "GROCERIES");
  });

  it("delete of a missing rule reports deleted=false and skips the re-application job", async () => {
    const { service, queue } = createService();

    const result = await service.delete("user-1", {
      ruleId: "11111111-2222-4333-8444-555555555555",
    });

    expect(result.deleted).toBe(false);
    expect(queue.add).not.toHaveBeenCalled();
  });
});
