import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCategories } from "@/features/finance/hooks/useCategories";
import { cn } from "@/lib/utils";
import type { SavedTransaction } from "@spark/orpc/contract";
import { RESET_TO_AUTOMATIC, useCategoryEditing } from "./useCategoryEditing";

interface CategoryPickerProps {
  transaction: SavedTransaction;
  /** "pill": quiet inline chip in a list row; "field": full-width control. */
  variant?: "pill" | "field";
  className?: string;
}

/** The transaction's category, changeable in place; manual choices can be reset. */
export function CategoryPicker({ transaction, variant = "pill", className }: CategoryPickerProps) {
  const { categories, resolve } = useCategories();
  const editing = useCategoryEditing();
  const current = resolve(transaction.category);
  const manual = transaction.categorySource === "USER_OVERRIDE";
  const name =
    transaction.merchant?.displayName ?? transaction.merchantName ?? transaction.description;

  return (
    <Select
      value={transaction.category}
      onValueChange={(next) => editing.change(transaction.id, transaction.category, next)}
    >
      <SelectTrigger
        size={variant === "pill" ? "sm" : "default"}
        aria-label={`Category for ${name}`}
        className={cn(
          variant === "pill" &&
            "hover:bg-muted dark:hover:bg-muted h-6 gap-1.5 rounded-full border-transparent bg-transparent px-2 text-xs shadow-none data-[size=sm]:h-6 data-[size=sm]:rounded-full dark:bg-transparent [&>svg:last-child]:size-3",
          variant === "field" && "w-full",
          className,
        )}
      >
        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: current.color }} />
        <SelectValue>
          <span className="text-foreground">{current.label}</span>
          {manual ? <span className="text-muted-foreground"> · set by you</span> : null}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {categories.map((category) => (
          <SelectItem key={category.id} value={category.id}>
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: category.color }}
            />
            {category.label}
          </SelectItem>
        ))}
        {manual ? (
          <>
            <SelectSeparator />
            <SelectItem value={RESET_TO_AUTOMATIC}>Reset to automatic</SelectItem>
          </>
        ) : null}
      </SelectContent>
    </Select>
  );
}
