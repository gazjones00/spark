import * as React from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  RuleEditor,
  type RuleDraft,
  type RuleEditorValues,
} from "@/features/finance/components/RuleEditor";
import { RulesList } from "@/features/finance/components/RulesList";
import { queryKeys } from "@/lib/query-keys";
import { orpc } from "@spark/orpc";
import type { CategoryRule } from "@spark/orpc/contract";

/**
 * Categorisation rules, alongside categories in Settings. Opened with
 * ?merchant= (and optionally ?category=) from a transaction, it starts a new
 * rule pre-filled for that merchant.
 */
export function Rules() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const linked = useSearch({ from: "/_authenticated/settings/rules" });
  const [editorOpen, setEditorOpen] = React.useState(false);
  // undefined = creating a new rule; set = editing that rule.
  const [editingRule, setEditingRule] = React.useState<CategoryRule | undefined>();
  const [draft, setDraft] = React.useState<RuleDraft | undefined>();
  const [deleting, setDeleting] = React.useState<CategoryRule | null>(null);

  React.useEffect(() => {
    if (linked.merchant) {
      setEditingRule(undefined);
      setDraft({ merchant: linked.merchant, category: linked.category });
      setEditorOpen(true);
      void navigate({ to: "/settings/rules", search: {}, replace: true });
    }
  }, [linked.merchant, linked.category, navigate]);

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
      toast.success("Rule created — recategorising history (your manual choices are kept)");
    },
    onError: () => toast.error("Couldn't create the rule. Please try again."),
  });

  const updateMutation = useMutation({
    mutationFn: (input: RuleEditorValues & { ruleId: string }) => orpc.rules.update.call(input),
    onSuccess: () => {
      invalidate();
      setEditorOpen(false);
      toast.success("Rule updated — recategorising history (your manual choices are kept)");
    },
    onError: () => toast.error("Couldn't update the rule. Please try again."),
  });

  const deleteMutation = useMutation({
    mutationFn: (ruleId: string) => orpc.rules.delete.call({ ruleId }),
    onSuccess: () => {
      invalidate();
      setDeleting(null);
      toast.success("Rule deleted — history is being recategorised");
    },
    onError: () => toast.error("Couldn't delete the rule. Please try again."),
  });

  const openCreate = () => {
    setEditingRule(undefined);
    setDraft(undefined);
    setEditorOpen(true);
  };

  const handleSubmit = (values: RuleEditorValues) => {
    if (editingRule) {
      updateMutation.mutate({ ...values, ruleId: editingRule.id });
    } else {
      createMutation.mutate(values);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <h2 className="text-lg font-semibold">Rules</h2>
          <p className="text-muted-foreground text-sm">
            Categorise transactions automatically. Rules apply to new syncs and to your history
            whenever they change; categories you chose yourself are never overwritten.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus />
          New rule
        </Button>
      </div>

      {rulesQuery.isLoading ? (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Loading rules…
        </div>
      ) : (
        <RulesList
          rules={rulesQuery.data?.rules ?? []}
          onEdit={(rule) => {
            setEditingRule(rule);
            setDraft(undefined);
            setEditorOpen(true);
          }}
          onDelete={setDeleting}
        />
      )}

      <RuleEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        rule={editingRule}
        draft={draft}
        onSubmit={handleSubmit}
        isPending={createMutation.isPending || updateMutation.isPending}
      />

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this rule?</DialogTitle>
            <DialogDescription>
              Transactions it categorised go back to their default categories. Categories you chose
              yourself stay as they are.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Keep rule
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
