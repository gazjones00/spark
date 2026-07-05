import * as React from "react";
import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { builtInCategoryDescriptors } from "@spark/common";
import { orpc } from "@spark/orpc";
import type { CategoryDescriptor } from "@spark/orpc/contract";

/** Built-in taxonomy as descriptors — the pre-fetch/offline fallback. */
const builtInDescriptors: CategoryDescriptor[] = builtInCategoryDescriptors();

export interface CategoriesLookup {
  /** Built-in + custom categories, in display order. */
  categories: CategoryDescriptor[];
  /**
   * Resolves a category reference (built-in value or custom id) to display
   * config. Unknown ids (e.g. a just-deleted custom category still present
   * in stale enrichment rows) degrade to a neutral descriptor.
   */
  resolve: (id: string) => CategoryDescriptor;
  isLoading: boolean;
}

export function useCategories(): CategoriesLookup {
  const query = useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => orpc.categories.list.call({}),
    staleTime: 60_000,
  });

  const categories = query.data?.categories ?? builtInDescriptors;

  const resolve = React.useMemo(() => {
    const byId = new Map(categories.map((category) => [category.id, category]));
    return (id: string): CategoryDescriptor =>
      byId.get(id) ?? { id, label: "Unknown", color: "var(--chart-5)", builtIn: false };
  }, [categories]);

  return { categories, resolve, isLoading: query.isLoading };
}
