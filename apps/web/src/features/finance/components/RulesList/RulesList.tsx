import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCategories } from "@/features/finance/hooks/useCategories";
import {
  amountOperatorLabels,
  fieldLabels,
  textOperatorLabels,
} from "@/features/finance/lib/rule-labels";
import type { CategoryRule, RuleCondition, RuleMatchers } from "@spark/orpc/contract";

interface RulesListProps {
  rules: CategoryRule[];
  onEdit: (rule: CategoryRule) => void;
  onDelete: (rule: CategoryRule) => void;
}

function describeCondition(condition: RuleCondition): string {
  const field = fieldLabels[condition.field].toLowerCase();
  if (condition.field === "AMOUNT") {
    if (condition.op === "BETWEEN") {
      return `${field} is ${condition.value}–${condition.valueMax}`;
    }
    return `${field} ${amountOperatorLabels[condition.op]} ${condition.value}`;
  }
  const value = condition.op === "REGEX" ? `/${condition.value}/` : `“${condition.value}”`;
  return `${field} ${textOperatorLabels[condition.op]} ${value}`;
}

/** Renders the OR-of-AND-groups matchers as a readable "if" sentence. */
function describeMatchers(matchers: RuleMatchers): string {
  const groups = matchers.groups.map((group) =>
    group.map((condition) => describeCondition(condition)).join(" and "),
  );
  if (groups.length === 1) {
    return groups[0]!;
  }
  return groups.map((group) => `(${group})`).join(" or ");
}

export function RulesList({ rules, onEdit, onDelete }: RulesListProps) {
  const { resolve } = useCategories();

  if (rules.length === 0) {
    return (
      <div className="text-muted-foreground bg-card rounded-xl border border-dashed p-8 text-center">
        <p className="text-sm">No rules yet.</p>
        <p className="text-xs">Create one to categorise matching transactions automatically.</p>
      </div>
    );
  }

  return (
    <div className="bg-card shadow-card overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>If</TableHead>
            <TableHead className="hidden sm:table-cell">Then categorise as</TableHead>
            <TableHead className="hidden w-[90px] sm:table-cell">Priority</TableHead>
            <TableHead className="w-[100px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.map((rule) => {
            const category = resolve(rule.category);
            const categoryLabel = (
              <>
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
                {category.label}
              </>
            );
            return (
              <TableRow key={rule.id}>
                <TableCell className="text-sm whitespace-normal">
                  {describeMatchers(rule.matchers)}
                  {/* Phones have no room for a category column, so it sits
                      under the condition instead. */}
                  <span className="text-muted-foreground mt-1 flex items-center gap-2 text-xs sm:hidden">
                    {categoryLabel}
                  </span>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <span className="flex items-center gap-2 text-sm">{categoryLabel}</span>
                </TableCell>
                <TableCell className="text-muted-foreground hidden font-mono text-xs tabular-nums sm:table-cell">
                  {rule.priority}
                </TableCell>
                <TableCell className="py-2 text-right">
                  <span className="-mr-1.5 inline-flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Edit rule"
                      onClick={() => onEdit(rule)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete rule"
                      onClick={() => onDelete(rule)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
