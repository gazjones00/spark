import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { RuleEditor, type RuleEditorValues } from "@/features/finance/components/RuleEditor";
import { RulesList } from "@/features/finance/components/RulesList";
import { queryKeys } from "@/lib/query-keys";
import { orpc } from "@spark/orpc";
import type { CategoryRule } from "@spark/orpc/contract";

export const Route = createFileRoute("/_authenticated/rules")({
  loader: ({ context }) => {
    if (typeof window === "undefined") return;
    void context.queryClient.prefetchQuery({
      queryKey: queryKeys.rules,
      queryFn: () => orpc.rules.list.call({}),
    });
  },
  component: RulesPage,
});

function RulesPage() {
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = React.useState(false);
  // undefined = creating a new rule; set = editing that rule.
  const [editingRule, setEditingRule] = React.useState<CategoryRule | undefined>();

  const rulesQuery = useQuery({
    queryKey: queryKeys.rules,
    queryFn: () => orpc.rules.list.call({}),
    refetchOnMount: "always",
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.rules });
    // Rule changes re-derive enrichment in the background; refresh reads.
    void queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
  };

  const createMutation = useMutation({
    mutationFn: (values: RuleEditorValues) => orpc.rules.create.call(values),
    onSuccess: () => {
      invalidate();
      setEditorOpen(false);
      toast.success("Rule created — recategorizing history (manual edits are kept)");
    },
    onError: () => toast.error("Failed to create rule"),
  });

  const updateMutation = useMutation({
    mutationFn: (input: RuleEditorValues & { ruleId: string }) => orpc.rules.update.call(input),
    onSuccess: () => {
      invalidate();
      setEditorOpen(false);
      toast.success("Rule updated — recategorizing history (manual edits are kept)");
    },
    onError: () => toast.error("Failed to update rule"),
  });

  const deleteMutation = useMutation({
    mutationFn: (ruleId: string) => orpc.rules.delete.call({ ruleId }),
    onSuccess: () => {
      invalidate();
      toast.success("Rule deleted — history is being recategorized");
    },
    onError: () => toast.error("Failed to delete rule"),
  });

  const openCreate = () => {
    setEditingRule(undefined);
    setEditorOpen(true);
  };

  const openEdit = (rule: CategoryRule) => {
    setEditingRule(rule);
    setEditorOpen(true);
  };

  const handleDelete = (rule: CategoryRule) => {
    if (window.confirm("Delete this rule? Matching transactions revert to their defaults.")) {
      deleteMutation.mutate(rule.id);
    }
  };

  const handleSubmit = (values: RuleEditorValues) => {
    if (editingRule) {
      updateMutation.mutate({ ...values, ruleId: editingRule.id });
    } else {
      createMutation.mutate(values);
    }
  };

  const rules = rulesQuery.data?.rules ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ledger"
        title="Rules"
        description="Automatically categorize transactions. Rules apply to new syncs and are re-applied to history whenever they change. Transactions you categorized by hand are never changed by rules."
        action={
          <Button className="gap-2" onClick={openCreate}>
            <Plus className="size-4" />
            New rule
          </Button>
        }
      />

      {rulesQuery.isLoading ? (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Loading rules…
        </div>
      ) : (
        <RulesList rules={rules} onEdit={openEdit} onDelete={handleDelete} />
      )}

      <RuleEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        rule={editingRule}
        onSubmit={handleSubmit}
        isPending={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}
