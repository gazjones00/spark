import { Link } from "@tanstack/react-router";
import { Landmark, LineChart, Lock, RefreshCw } from "lucide-react";

import { SparkAppIcon } from "@/components/spark-mark";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    icon: Landmark,
    title: "Connect your bank",
    body: "Pick your bank and approve access in its own app. Takes about a minute.",
  },
  {
    icon: RefreshCw,
    title: "We sync your history",
    body: "Balances and up to 90 days of transactions, kept up to date automatically.",
  },
  {
    icon: LineChart,
    title: "See the whole picture",
    body: "Net worth, spending by category and where your money goes each month.",
  },
] as const;

/** First run: what connecting involves, why it's safe, and one clear next step. */
export function OnboardingCard() {
  return (
    <Card className="overflow-hidden p-0">
      <div className="grid md:grid-cols-[1.1fr_1fr]">
        <CardContent className="space-y-6 p-6 sm:p-8">
          <SparkAppIcon className="size-11" />
          <div>
            <h2 className="text-foreground text-2xl font-bold">Let's connect your first account</h2>
            <p className="text-muted-foreground mt-2 text-[0.9375rem]">
              Spark brings your current accounts, savings and credit cards together in one calm
              view.
            </p>
          </div>
          <ol className="space-y-4">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span className="bg-accent text-accent-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                  {index + 1}
                </span>
                <span>
                  <span className="text-foreground block text-sm font-semibold">{step.title}</span>
                  <span className="text-muted-foreground block text-sm">{step.body}</span>
                </span>
              </li>
            ))}
          </ol>
          <Link
            to="/accounts/connect"
            className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}
          >
            Connect an account
          </Link>
        </CardContent>
        <div className="bg-spark-gradient relative hidden items-end p-8 text-white md:flex">
          <div className="bg-dotgrid absolute inset-0 opacity-25 [--dotgrid-color:rgb(255_255_255/0.5)]" />
          <div className="relative space-y-3">
            <Lock className="size-6" />
            <p className="font-display text-xl font-bold">Read-only, by design</p>
            <p className="text-sm text-white/85">
              Connections use regulated UK Open Banking. Spark can see balances and transactions —
              it can never move money. You can revoke access at any time from your bank or here.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
