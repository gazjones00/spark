import * as React from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCategories } from "@/features/finance/hooks/useCategories";
import {
  amountOperatorOptions,
  fieldLabels,
  textOperatorOptions,
} from "@/features/finance/lib/rule-labels";
import { CreateCategoryRuleInputSchema } from "@spark/orpc/contract";
import type {
  CategoryRule,
  RuleAmountOperator,
  RuleCondition,
  RuleMatchers,
  RuleTextOperator,
} from "@spark/orpc/contract";

type ConditionField = RuleCondition["field"];

/** Editable (stringly-typed) form row; converted to a RuleCondition on save. */
interface ConditionForm {
  field: ConditionField;
  op: string;
  value: string;
  valueMax: string;
}

function emptyCondition(): ConditionForm {
  return { field: "MERCHANT", op: "CONTAINS", value: "", valueMax: "" };
}

function toForm(condition: RuleCondition): ConditionForm {
  return {
    field: condition.field,
    op: condition.op,
    value: String(condition.value),
    valueMax:
      condition.field === "AMOUNT" && condition.valueMax !== undefined
        ? String(condition.valueMax)
        : "",
  };
}

function initialGroups(rule?: CategoryRule): ConditionForm[][] {
  if (!rule) {
    return [[emptyCondition()]];
  }
  return rule.matchers.groups.map((group) => group.map((condition) => toForm(condition)));
}

export interface RuleEditorValues {
  matchers: RuleMatchers;
  /** Category reference: built-in value or custom category id. */
  category: string;
  priority: number;
}

interface RuleEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing rule to edit; omit to create a new one. */
  rule?: CategoryRule;
  onSubmit: (values: RuleEditorValues) => void;
  isPending?: boolean;
}

/**
 * Create/edit dialog for a categorization rule, in the spirit of Actual
 * Budget's rule editor: "IF <conditions> THEN categorize as <category>".
 * Conditions within a group are ANDed; groups are ORed, so
 * "(merchant contains amazon AND description contains aws) OR
 * (merchant contains aws)" is one rule with two groups.
 */
export function RuleEditor({ open, onOpenChange, rule, onSubmit, isPending }: RuleEditorProps) {
  const { categories, resolve } = useCategories();
  const [groups, setGroups] = React.useState<ConditionForm[][]>(() => initialGroups(rule));
  const [category, setCategory] = React.useState<string>(rule?.category ?? "OTHER");
  const [priority, setPriority] = React.useState(rule?.priority.toString() ?? "0");
  const [error, setError] = React.useState<string | null>(null);

  // Re-seed the form each time the dialog opens for a (possibly different) rule.
  React.useEffect(() => {
    if (open) {
      setGroups(initialGroups(rule));
      setCategory(rule?.category ?? "OTHER");
      setPriority(rule?.priority.toString() ?? "0");
      setError(null);
    }
  }, [open, rule]);

  const updateCondition = (
    groupIndex: number,
    conditionIndex: number,
    patch: Partial<ConditionForm>,
  ) => {
    setGroups((previous) =>
      previous.map((group, gi) =>
        gi !== groupIndex
          ? group
          : group.map((condition, ci) =>
              ci !== conditionIndex ? condition : { ...condition, ...patch },
            ),
      ),
    );
  };

  const changeField = (groupIndex: number, conditionIndex: number, field: ConditionField) => {
    // Reset the operator to a sensible default when switching field kinds.
    const op = field === "AMOUNT" ? "AT_LEAST" : "CONTAINS";
    updateCondition(groupIndex, conditionIndex, { field, op, value: "", valueMax: "" });
  };

  const addCondition = (groupIndex: number) => {
    setGroups((previous) =>
      previous.map((group, gi) => (gi === groupIndex ? [...group, emptyCondition()] : group)),
    );
  };

  const removeCondition = (groupIndex: number, conditionIndex: number) => {
    setGroups((previous) =>
      previous
        .map((group, gi) =>
          gi === groupIndex ? group.filter((_, ci) => ci !== conditionIndex) : group,
        )
        .filter((group) => group.length > 0),
    );
  };

  const addGroup = () => {
    setGroups((previous) => [...previous, [emptyCondition()]]);
  };

  const handleSubmit = () => {
    const builtGroups: RuleCondition[][] = [];

    for (const group of groups) {
      const built: RuleCondition[] = [];
      for (const condition of group) {
        const value = condition.value.trim();
        if (!value) {
          setError("Every condition needs a value");
          return;
        }

        if (condition.field === "AMOUNT") {
          const amount = Number(value);
          const max = condition.valueMax.trim() ? Number(condition.valueMax) : undefined;
          if (Number.isNaN(amount) || Number.isNaN(max ?? 0)) {
            setError("Amounts must be numbers");
            return;
          }
          if (condition.op === "BETWEEN" && max === undefined) {
            setError("BETWEEN needs an upper bound");
            return;
          }
          built.push({
            field: "AMOUNT",
            op: condition.op as RuleAmountOperator,
            value: amount,
            ...(condition.op === "BETWEEN" && max !== undefined ? { valueMax: max } : {}),
          });
        } else {
          built.push({
            field: condition.field,
            op: condition.op as RuleTextOperator,
            value: condition.field === "MERCHANT" ? value.toLowerCase() : value,
          });
        }
      }
      if (built.length > 0) {
        builtGroups.push(built);
      }
    }

    if (builtGroups.length === 0) {
      setError("Add at least one condition");
      return;
    }

    // Validate with the same schema the API enforces (regex compile, BETWEEN
    // bounds, length caps, priority range) so nothing passes the form only to
    // die at the boundary with a generic error.
    const parsed = CreateCategoryRuleInputSchema.safeParse({
      matchers: { groups: builtGroups },
      category,
      priority: Number(priority || "0"),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid rule");
      return;
    }

    setError(null);
    onSubmit(parsed.data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{rule ? "Edit rule" : "New rule"}</DialogTitle>
          <DialogDescription>
            A transaction matches when all conditions in any one group hold. Groups are combined
            with OR. Transactions you categorized by hand keep their category — reset one to
            automatic from the transactions table to let rules apply to it.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
          {groups.map((group, groupIndex) => (
            <React.Fragment key={groupIndex}>
              {groupIndex > 0 && (
                <p className="eyebrow text-muted-foreground text-center text-[10px]">— or —</p>
              )}
              <div className="space-y-2 border p-3">
                <p className="eyebrow text-muted-foreground text-[10px]">If all of the following</p>
                {group.map((condition, conditionIndex) => {
                  const operators =
                    condition.field === "AMOUNT" ? amountOperatorOptions : textOperatorOptions;
                  return (
                    <div key={conditionIndex} className="flex flex-wrap items-center gap-2">
                      <Select
                        value={condition.field}
                        onValueChange={(value) =>
                          value && changeField(groupIndex, conditionIndex, value as ConditionField)
                        }
                      >
                        <SelectTrigger size="sm" className="w-[150px]">
                          <SelectValue>{fieldLabels[condition.field]}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(fieldLabels) as ConditionField[]).map((field) => (
                            <SelectItem key={field} value={field}>
                              {fieldLabels[field]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={condition.op}
                        onValueChange={(value) =>
                          value && updateCondition(groupIndex, conditionIndex, { op: value })
                        }
                      >
                        <SelectTrigger size="sm" className="w-[130px]">
                          <SelectValue>
                            {operators.find((op) => op.value === condition.op)?.label ??
                              condition.op}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {operators.map((op) => (
                            <SelectItem key={op.value} value={op.value}>
                              {op.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Input
                        className="h-7 min-w-[120px] flex-1 text-xs"
                        inputMode={condition.field === "AMOUNT" ? "decimal" : "text"}
                        placeholder={condition.field === "AMOUNT" ? "0.00" : "value"}
                        aria-label="Condition value"
                        value={condition.value}
                        onChange={(e) =>
                          updateCondition(groupIndex, conditionIndex, { value: e.target.value })
                        }
                      />

                      {condition.field === "AMOUNT" && condition.op === "BETWEEN" && (
                        <>
                          <span className="text-muted-foreground text-xs">and</span>
                          <Input
                            className="h-7 w-[100px] text-xs"
                            inputMode="decimal"
                            placeholder="100.00"
                            aria-label="Condition upper bound"
                            value={condition.valueMax}
                            onChange={(e) =>
                              updateCondition(groupIndex, conditionIndex, {
                                valueMax: e.target.value,
                              })
                            }
                          />
                        </>
                      )}

                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Remove condition"
                        onClick={() => removeCondition(groupIndex, conditionIndex)}
                      >
                        <X className="size-3" />
                      </Button>
                    </div>
                  );
                })}
                <Button variant="ghost" size="xs" onClick={() => addCondition(groupIndex)}>
                  <Plus className="size-3" />
                  And condition
                </Button>
              </div>
            </React.Fragment>
          ))}

          <Button variant="outline" size="xs" onClick={addGroup}>
            <Plus className="size-3" />
            Or group
          </Button>

          <div className="space-y-2 pt-2">
            <p className="eyebrow text-muted-foreground text-[10px]">Then categorize as</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={category} onValueChange={(value) => value && setCategory(value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue>{resolve(category).label}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rule-priority">Priority</Label>
                <Input
                  id="rule-priority"
                  inputMode="numeric"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                />
              </div>
            </div>
          </div>

          {error && <p className="text-destructive text-xs">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {rule ? "Save rule" : "Create rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
