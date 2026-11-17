import * as React from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { queryKeys } from "@/lib/query-keys";
import { orpc } from "@spark/orpc";
import type { Account } from "@spark/orpc/contract";

interface AccountDialogProps {
  account: Account | null;
  onOpenChange: (open: boolean) => void;
}

/** Rename an account (the name shown in Spark only; the bank's is unchanged). */
export function RenameAccountDialog({ account, onOpenChange }: AccountDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = React.useState("");

  React.useEffect(() => {
    if (account) setName(account.displayName);
  }, [account]);

  const rename = useMutation({
    mutationFn: (input: { id: string; displayName: string }) => orpc.accounts.update.call(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
      toast.success("Account renamed");
      onOpenChange(false);
    },
    onError: () => toast.error("Couldn't rename the account. Please try again."),
  });

  const trimmed = name.trim();
  const unchanged = trimmed === account?.displayName;

  return (
    <Dialog open={account !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (account && trimmed && !unchanged) {
              rename.mutate({ id: account.id, displayName: trimmed });
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Rename account</DialogTitle>
            <DialogDescription>
              Choose a name that's easy to recognise. This only changes it in Spark.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="account-name">Name</Label>
            <Input
              id="account-name"
              value={name}
              maxLength={255}
              autoFocus
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!trimmed || unchanged || rename.isPending}>
              {rename.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Remove an account from Spark, with a plain statement of what that does. */
export function RemoveAccountDialog({ account, onOpenChange }: AccountDialogProps) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: (id: string) => orpc.accounts.delete.call({ id }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
      void queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
      toast.success("Account removed");
      onOpenChange(false);
    },
    onError: () => toast.error("Couldn't remove the account. Please try again."),
  });

  return (
    <Dialog open={account !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remove {account?.displayName}?</DialogTitle>
          <DialogDescription>
            Its balance and transaction history will be removed from Spark and it will stop syncing.
            Your account at the bank isn't affected. If it's the last account from this bank,
            Spark's access to the bank is revoked too.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Keep account
          </Button>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => account && remove.mutate(account.id)}
          >
            {remove.isPending ? "Removing…" : "Remove account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
