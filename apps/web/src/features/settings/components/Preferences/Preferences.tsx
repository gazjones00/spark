import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { orpc } from "@spark/orpc";

const currencies = [
  { value: "GBP", label: "GBP (£)" },
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "AUD", label: "AUD (A$)" },
];

const themes = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function Preferences() {
  const queryClient = useQueryClient();

  const { data: preferences } = useQuery({
    queryKey: ["settings", "preferences"],
    queryFn: () => orpc.settings.getUserPreferences.call({}),
  });

  const mutation = useMutation({
    mutationFn: (input: { displayCurrency?: string; theme?: "system" | "light" | "dark" }) =>
      orpc.settings.updateUserPreferences.call(input),
    onSuccess: (data) => {
      queryClient.setQueryData(["settings", "preferences"], data);
      toast.success("Preferences updated");
    },
    onError: () => {
      toast.error("Failed to update preferences");
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Preferences</h2>
        <p className="text-muted-foreground text-sm">Customize your experience</p>
      </div>

      <Card>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Display Currency</Label>
            <Select
              value={preferences?.displayCurrency ?? "GBP"}
              onValueChange={(value) => {
                if (value) mutation.mutate({ displayCurrency: value });
              }}
              disabled={mutation.isPending}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((currency) => (
                  <SelectItem key={currency.value} value={currency.value}>
                    {currency.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              Currency used for displaying balances and transactions
            </p>
          </div>

          <div className="space-y-2">
            <Label>Theme</Label>
            <Select
              value={preferences?.theme ?? "system"}
              onValueChange={(value) => {
                if (value) mutation.mutate({ theme: value as "system" | "light" | "dark" });
              }}
              disabled={mutation.isPending}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {themes.map((theme) => (
                  <SelectItem key={theme.value} value={theme.value}>
                    {theme.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">Choose your preferred color scheme</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
