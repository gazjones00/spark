import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useHydrated } from "@/lib/use-hydrated";
import { useAuth } from "@spark/auth/react";
import { updateUser } from "@spark/auth/client";

const profileSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .transform((v) => v.trim()),
});

type ProfileForm = z.infer<typeof profileSchema>;

export function Profile() {
  const { user: sessionUser, refetch } = useAuth();
  const hydrated = useHydrated();
  const user = sessionUser;

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name ?? "" },
  });

  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const onSubmit = async (data: ProfileForm) => {
    try {
      const result = await updateUser({ name: data.name });
      if (result.error) {
        toast.error(result.error.message ?? "Failed to update profile");
      } else {
        await refetch();
        form.reset({ name: data.name });
        toast.success("Profile updated");
      }
    } catch {
      toast.error("Failed to update profile");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Profile</h2>
        <p className="text-muted-foreground text-sm">Manage your personal information</p>
      </div>

      <Card>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="size-16">
              <AvatarImage src={user?.image ?? undefined} />
              <AvatarFallback className="bg-accent text-accent-foreground font-display text-lg font-semibold">
                {(hydrated && initials) || <User className="size-6" />}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{hydrated ? user?.name : null}</p>
              <p className="text-muted-foreground text-sm">{hydrated ? user?.email : null}</p>
            </div>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-md space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Display name</Label>
              <Input id="name" placeholder="Your name" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-destructive text-xs">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user?.email ?? ""} disabled />
              <p className="text-muted-foreground text-xs">Email cannot be changed</p>
            </div>

            <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
              {form.formState.isSubmitting ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
