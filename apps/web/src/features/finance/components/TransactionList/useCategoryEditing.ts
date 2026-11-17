import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { queryKeys } from "@/lib/query-keys";
import { orpc } from "@spark/orpc";

/** Sentinel option meaning "drop my override and let rules decide again". */
export const RESET_TO_AUTOMATIC = "__reset__";

/** Change or reset a transaction's category, keeping lists and totals fresh. */
export function useCategoryEditing() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.transactions });

  const setCategory = useMutation({
    mutationFn: (input: { transactionId: string; category: string }) =>
      orpc.transactions.setCategory.call(input),
    onSuccess: () => void invalidate(),
    onError: () => toast.error("Couldn't update the category. Please try again."),
  });

  const clearCategory = useMutation({
    mutationFn: (input: { transactionId: string }) => orpc.transactions.clearCategory.call(input),
    onSuccess: () => {
      void invalidate();
      toast.success("Category reset — rules apply again");
    },
    onError: () => toast.error("Couldn't reset the category. Please try again."),
  });

  return {
    change(transactionId: string, current: string, next: string | null) {
      if (next === RESET_TO_AUTOMATIC) {
        clearCategory.mutate({ transactionId });
      } else if (next && next !== current) {
        setCategory.mutate({ transactionId, category: next });
      }
    },
  };
}
