import { useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { authClient, useAuth } from "@spark/auth/react";

const deleteAccountSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

type DeleteAccountForm = z.infer<typeof deleteAccountSchema>;

export function DangerZone() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const form = useForm<DeleteAccountForm>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: { password: "" },
  });

  const onSubmit = async (data: DeleteAccountForm) => {
    try {
      await authClient.deleteUser({ password: data.password });
      toast.success("Account deleted");
      await logout();
      navigate({ to: "/login" });
    } catch {
      toast.error("Failed to delete account. Check your password.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Danger Zone</h2>
        <p className="text-muted-foreground text-sm">
          Irreversible actions that affect your account
        </p>
      </div>

      <Card className="border-destructive/50">
        <CardContent>
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-destructive mt-0.5 size-5 shrink-0" />
            <div className="space-y-2">
              <p className="text-sm font-medium">Delete Account</p>
              <p className="text-muted-foreground text-xs">
                Permanently delete your account and all associated data. This action cannot be
                undone. All connected bank accounts, transaction history, and preferences will be
                removed.
              </p>
              <Dialog>
                <DialogTrigger
                  render={<Button variant="destructive" size="sm" className="mt-2 mb-0" />}
                >
                  Delete Account
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={form.handleSubmit(onSubmit)}>
                    <DialogHeader>
                      <DialogTitle>Are you sure?</DialogTitle>
                      <DialogDescription>
                        This action cannot be undone. All your data will be permanently deleted.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-4">
                      <Label htmlFor="delete-password">Enter your password to confirm</Label>
                      <Input
                        id="delete-password"
                        type="password"
                        placeholder="Enter your password"
                        {...form.register("password")}
                      />
                      {form.formState.errors.password && (
                        <p className="text-destructive text-xs">
                          {form.formState.errors.password.message}
                        </p>
                      )}
                    </div>
                    <DialogFooter>
                      <DialogClose render={<Button variant="outline" type="button" />}>
                        Cancel
                      </DialogClose>
                      <Button
                        variant="destructive"
                        type="submit"
                        disabled={form.formState.isSubmitting}
                      >
                        {form.formState.isSubmitting ? "Deleting..." : "Delete Account"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
