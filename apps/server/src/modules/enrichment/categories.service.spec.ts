import { ConflictException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { Jobs } from "../message-queue";
import { CategoriesService } from "./categories.service";

interface FakeOptions {
  /** Rows returned by select().from().where() [.limit()] calls, in order. */
  selectResults?: unknown[][];
  /** Row returned by insert().values().onConflictDoNothing().returning(). */
  insertResult?: Record<string, unknown>[];
  /** Rows returned by delete().where().returning(). */
  deleteResult?: Record<string, unknown>[];
}

function createService(options: FakeOptions = {}) {
  const selectResults = [...(options.selectResults ?? [[]])];
  const nextSelect = () => Promise.resolve(selectResults.shift() ?? []);

  const selectChain = () => {
    const result: Record<string, unknown> = {};
    result.from = () => result;
    result.where = () => {
      const promise = nextSelect() as Promise<unknown[]> & { limit?: unknown; orderBy?: unknown };
      promise.limit = () => promise;
      promise.orderBy = () => promise;
      return promise;
    };
    result.orderBy = () => nextSelect();
    return result;
  };

  const db = {
    select: () => selectChain(),
    insert: () => ({
      values: () => ({
        onConflictDoNothing: () => ({
          returning: () => Promise.resolve(options.insertResult ?? []),
        }),
      }),
    }),
    delete: () => ({
      where: () => ({
        returning: () => Promise.resolve(options.deleteResult ?? []),
      }),
    }),
    // The advisory category-refs lock taken inside delete's transaction.
    execute: vi.fn(async () => undefined),
    transaction: <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn(db),
  };

  const queue = { add: vi.fn(async () => undefined) };
  const service = new CategoriesService(db as never, queue as never);
  return { service, queue, db };
}

const CATEGORY_ROW = {
  id: "11111111-2222-4333-8444-555555555555",
  userId: "user-1",
  name: "Pets",
  normalizedName: "pets",
  color: "var(--chart-2)",
  createdAt: new Date("2026-07-01T00:00:00Z"),
  updatedAt: new Date("2026-07-01T00:00:00Z"),
};

describe("CategoriesService", () => {
  it("lists built-in and custom categories in one descriptor list", async () => {
    const { service } = createService({ selectResults: [[CATEGORY_ROW]] });

    const result = await service.list("user-1");

    const builtIn = result.categories.filter((category) => category.builtIn);
    const custom = result.categories.filter((category) => !category.builtIn);
    expect(builtIn.length).toBeGreaterThan(10);
    expect(builtIn.some((category) => category.id === "GROCERIES")).toBe(true);
    expect(custom).toEqual([
      { id: CATEGORY_ROW.id, label: "Pets", color: "var(--chart-2)", builtIn: false },
    ]);
  });

  it("create rejects names that shadow a built-in category", async () => {
    const { service } = createService();

    await expect(service.create("user-1", { name: "Groceries" })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it("create rejects case-insensitive duplicates via the unique upsert", async () => {
    // onConflictDoNothing returns no row → an equivalent name already exists.
    const { service } = createService({ selectResults: [[]], insertResult: [] });

    await expect(service.create("user-1", { name: "Pets" })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it("delete is blocked while a rule references the category", async () => {
    const { service, queue } = createService({
      selectResults: [[{ id: "rule-1" }]],
    });

    await expect(service.delete("user-1", { categoryId: CATEGORY_ROW.id })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(queue.add).not.toHaveBeenCalled();
  });

  it("delete is blocked while an override references the category", async () => {
    const { service, queue } = createService({
      selectResults: [[], [{ id: "override-1" }]],
    });

    await expect(service.delete("user-1", { categoryId: CATEGORY_ROW.id })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(queue.add).not.toHaveBeenCalled();
  });

  it("delete of an unreferenced category enqueues re-application", async () => {
    const { service, queue, db } = createService({
      selectResults: [[], []],
      deleteResult: [{ id: CATEGORY_ROW.id }],
    });

    const result = await service.delete("user-1", { categoryId: CATEGORY_ROW.id });

    expect(result.deleted).toBe(true);
    // The in-use checks and delete run under the category-refs advisory lock.
    expect(db.execute).toHaveBeenCalledTimes(1);
    expect(queue.add).toHaveBeenCalledWith(Jobs.EnrichmentReapply, { userId: "user-1" });
  });

  it("assertValidCategoryId accepts built-ins without touching the db", async () => {
    const { service } = createService({ selectResults: [] });

    await expect(service.assertValidCategoryId("user-1", "GROCERIES")).resolves.toBeUndefined();
  });

  it("assertValidCategoryId rejects unknown custom ids", async () => {
    const { service } = createService({ selectResults: [[]] });

    await expect(service.assertValidCategoryId("user-1", "not-a-category")).rejects.toThrow(
      /unknown category/i,
    );
  });
});
