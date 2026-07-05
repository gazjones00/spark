import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCategories } from "@/features/finance/hooks/useCategories";
import { queryKeys } from "@/lib/query-keys";
import { orpc } from "@spark/orpc";
import { CATEGORY_COLORS } from "@spark/orpc/contract";
import type { CategoryColor, CategoryDescriptor } from "@spark/orpc/contract";

function ColorSwatchPicker({
  value,
  onChange,
}: {
  value: CategoryColor;
  onChange: (color: CategoryColor) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {CATEGORY_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={`Colour ${color}`}
          className="flex size-6 items-center justify-center border"
          style={{ backgroundColor: color }}
          onClick={() => onChange(color)}
        >
          {value === color && <Check className="size-3 text-background" />}
        </button>
      ))}
    </div>
  );
}

export function Categories() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = React.useState("");
  const [newColor, setNewColor] = React.useState<CategoryColor>(CATEGORY_COLORS[0]!);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editColor, setEditColor] = React.useState<CategoryColor>(CATEGORY_COLORS[0]!);

  const { categories } = useCategories();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.categories });
    void queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
  };

  const createMutation = useMutation({
    mutationFn: () => orpc.categories.create.call({ name: newName.trim(), color: newColor }),
    onSuccess: (created) => {
      invalidate();
      setNewName("");
      toast.success(`Category "${created.name}" created`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to create category");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (input: { categoryId: string; name?: string; color?: CategoryColor }) =>
      orpc.categories.update.call(input),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
      toast.success("Category updated");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to update category");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (categoryId: string) => orpc.categories.delete.call({ categoryId }),
    onSuccess: () => {
      invalidate();
      toast.success("Category deleted");
    },
    onError: (error) => {
      // The server blocks deletion while rules/overrides reference the
      // category; surface its explanation directly.
      toast.error(error instanceof Error ? error.message : "Failed to delete category");
    },
  });

  const builtIn = categories.filter((category) => category.builtIn);
  const custom = categories.filter((category) => !category.builtIn);

  const startEditing = (category: CategoryDescriptor) => {
    setEditingId(category.id);
    setEditName(category.label);
    setEditColor(
      (CATEGORY_COLORS.includes(category.color as CategoryColor)
        ? category.color
        : CATEGORY_COLORS[0]!) as CategoryColor,
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Categories</h2>
        <p className="text-muted-foreground text-sm">
          Add your own spending categories alongside the built-in ones. Custom categories can be
          used in transaction edits and rules.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-category-name">New category</Label>
            <div className="flex flex-wrap items-center gap-3">
              <Input
                id="new-category-name"
                className="w-56"
                placeholder="e.g. Pets"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <ColorSwatchPicker value={newColor} onChange={setNewColor} />
              <Button
                size="sm"
                disabled={!newName.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                <Plus className="size-3.5" />
                Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-1">
          <p className="eyebrow text-muted-foreground mb-3 text-[10px]">Your categories</p>
          {custom.length === 0 && (
            <p className="text-muted-foreground text-sm">No custom categories yet.</p>
          )}
          {custom.map((category) =>
            editingId === category.id ? (
              <div key={category.id} className="flex flex-wrap items-center gap-3 border-b py-2">
                <Input
                  className="w-56"
                  value={editName}
                  aria-label="Category name"
                  onChange={(e) => setEditName(e.target.value)}
                />
                <ColorSwatchPicker value={editColor} onChange={setEditColor} />
                <span className="inline-flex items-center gap-1">
                  <Button
                    size="sm"
                    disabled={!editName.trim() || updateMutation.isPending}
                    onClick={() =>
                      updateMutation.mutate({
                        categoryId: category.id,
                        name: editName.trim(),
                        color: editColor,
                      })
                    }
                  >
                    Save
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => setEditingId(null)}>
                    <X className="size-3.5" />
                  </Button>
                </span>
              </div>
            ) : (
              <div
                key={category.id}
                className="flex items-center justify-between border-b py-2 last:border-0"
              >
                <span className="inline-flex items-center gap-2 text-sm">
                  <span className="size-2.5" style={{ backgroundColor: category.color }} />
                  {category.label}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit ${category.label}`}
                    onClick={() => startEditing(category)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${category.label}`}
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      if (window.confirm(`Delete the "${category.label}" category?`)) {
                        deleteMutation.mutate(category.id);
                      }
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </span>
              </div>
            ),
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <p className="eyebrow text-muted-foreground mb-3 text-[10px]">Built-in categories</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {builtIn.map((category) => (
              <span key={category.id} className="inline-flex items-center gap-2 text-sm">
                <span className="size-2.5" style={{ backgroundColor: category.color }} />
                {category.label}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
