import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { orpc } from "@spark/orpc";

const notificationOptions = [
  {
    key: "largeTransactions" as const,
    label: "Large Transactions",
    description: "Get notified when a transaction exceeds your defined threshold",
  },
  {
    key: "lowBalance" as const,
    label: "Low Balance",
    description: "Get notified when an account balance falls below a threshold",
  },
  {
    key: "budgetOverspend" as const,
    label: "Budget Overspend",
    description: "Get notified when you exceed your budget in a category",
  },
  {
    key: "syncFailures" as const,
    label: "Sync Failures",
    description: "Get notified when an account sync fails or needs re-authentication",
  },
];

export function Notifications() {
  const queryClient = useQueryClient();

  const { data: preferences } = useQuery({
    queryKey: ["settings", "notifications"],
    queryFn: () => orpc.settings.getNotificationPreferences.call({}),
  });

  const mutation = useMutation({
    mutationFn: (input: Record<string, boolean>) =>
      orpc.settings.updateNotificationPreferences.call(input),
    onSuccess: (data) => {
      queryClient.setQueryData(["settings", "notifications"], data);
      toast.success("Notification preferences updated");
    },
    onError: () => {
      toast.error("Failed to update notification preferences");
    },
  });

  const handleToggle = (key: string, checked: boolean) => {
    mutation.mutate({ [key]: checked });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Notifications</h2>
        <p className="text-muted-foreground text-sm">
          Choose which notifications you want to receive
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4">
          {notificationOptions.map((option) => (
            <div key={option.key} className="flex items-start gap-3">
              <Checkbox
                id={option.key}
                checked={preferences?.[option.key] ?? true}
                onCheckedChange={(checked) => handleToggle(option.key, checked as boolean)}
                disabled={mutation.isPending}
              />
              <div className="space-y-0.5">
                <Label
                  htmlFor={option.key}
                  className="text-sm leading-none font-medium cursor-pointer mb-2"
                >
                  {option.label}
                </Label>
                <p className="text-muted-foreground text-xs">{option.description}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
