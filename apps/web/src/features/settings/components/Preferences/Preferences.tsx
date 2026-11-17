import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
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
import { useHydrated } from "@/lib/use-hydrated";
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

type Theme = "system" | "light" | "dark";

export function Preferences() {
  const queryClient = useQueryClient();
  // The theme in use lives in the browser, so this control shows and changes
  // that one (the same as the account menu) as well as saving the choice.
  const { theme, setTheme } = useTheme();
  const hydrated = useHydrated();

  const { data: preferences } = useQuery({
    queryKey: ["settings", "preferences"],
    queryFn: () => orpc.settings.getUserPreferences.call({}),
  });

  const mutation = useMutation({
    mutationFn: (input: { displayCurrency?: string; theme?: Theme }) =>
      orpc.settings.updateUserPreferences.call(input),
    onSuccess: (data) => {
      queryClient.setQueryData(["settings", "preferences"], data);
      toast.success("Preferences updated");
    },
    onError: () => {
      toast.error("Failed to update preferences");
    },
  });

  const currency = preferences?.displayCurrency ?? "GBP";
  const activeTheme = (hydrated ? theme : undefined) ?? preferences?.theme ?? "system";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Preferences</h2>
        <p className="text-muted-foreground text-sm">Customise your experience</p>
      </div>

      <Card>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Display currency</Label>
            <Select
              value={currency}
              onValueChange={(value) => {
                if (value) mutation.mutate({ displayCurrency: value });
              }}
              disabled={mutation.isPending}
            >
              <SelectTrigger className="w-48">
                <SelectValue>
                  {currencies.find((option) => option.value === currency)?.label ?? currency}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {currencies.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
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
              value={activeTheme}
              onValueChange={(value) => {
                if (!value) return;
                setTheme(value);
                mutation.mutate({ theme: value as Theme });
              }}
              disabled={mutation.isPending}
            >
              <SelectTrigger className="w-48">
                <SelectValue>
                  {themes.find((option) => option.value === activeTheme)?.label ?? activeTheme}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {themes.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">Choose your preferred colour scheme</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
