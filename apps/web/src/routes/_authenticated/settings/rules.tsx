import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { Rules } from "@/features/settings/components/Rules";
import { queryKeys } from "@/lib/query-keys";
import { orpc } from "@spark/orpc";

/** ?merchant= (and ?category=) start a new rule pre-filled from a transaction. */
const searchSchema = z.object({
  merchant: z.string().optional(),
  category: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/settings/rules")({
  validateSearch: searchSchema,
  loader: ({ context }) => {
    if (typeof window === "undefined") return;
    void context.queryClient.prefetchQuery({
      queryKey: queryKeys.rules,
      queryFn: () => orpc.rules.list.call({}),
    });
  },
  component: Rules,
});
