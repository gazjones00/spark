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
      <div className="text-muted-foreground rounded-none border border-dashed p-8 text-center">
        <p className="text-sm">No rules yet.</p>
        <p className="text-xs">Create one to categorize matching transactions automatically.</p>
      </div>
    );
  }

  return (
    <div className="rounded-none border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>If</TableHead>
            <TableHead>Then categorize as</TableHead>
            <TableHead className="w-[90px]">Priority</TableHead>
            <TableHead className="w-[90px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.map((rule) => (
            <TableRow key={rule.id}>
              <TableCell className="text-sm">{describeMatchers(rule.matchers)}</TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-2 text-xs">
                  <span
                    className="size-2 shrink-0"
                    style={{ backgroundColor: resolve(rule.category).color }}
                  />
                  {resolve(rule.category).label}
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground font-mono text-xs tabular-nums">
                {rule.priority}
              </TableCell>
              <TableCell className="text-right">
                <span className="inline-flex items-center gap-1">
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
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
