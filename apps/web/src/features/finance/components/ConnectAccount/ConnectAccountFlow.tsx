import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Check,
  Landmark,
  Loader2,
  Lock,
  MousePointerClick,
  ShieldCheck,
} from "lucide-react";

import { SparkAppIcon } from "@/components/spark-mark";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { BankLogo } from "@/features/finance/components/BankLogo";
import { cn } from "@/lib/utils";
import type { Account } from "@spark/truelayer/types";
import { useConnectAccount } from "./hooks/useConnectAccount";
import { formatAccountNumber, formatAccountType } from "./utils";

/**
 * Connecting a bank, as a page rather than a dialog: start → the bank's own
 * consent screens (TrueLayer) → back here to choose accounts → done. The
 * hook picks the journey up again from the callback's ?code&state.
 */
export function ConnectAccountFlow({ onDone }: { onDone: () => void }) {
  const flow = useConnectAccount({ onSuccess: onDone });

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6 sm:p-8">
        {flow.step === "start" ? <StartStep onStart={flow.handleStartConnection} /> : null}
        {flow.step === "loading" ? (
          <LoadingStep title="Connecting to your bank…" description="This takes a few seconds." />
        ) : null}
        {flow.step === "select-accounts" ? (
          <SelectAccountsStep
            accounts={flow.accounts}
            selected={flow.selectedAccountIds}
            onToggle={flow.handleAccountToggle}
            onSelectAll={flow.handleSelectAll}
            onSave={flow.handleSaveAccounts}
          />
        ) : null}
        {flow.step === "saving" ? (
          <LoadingStep title="Adding your accounts…" description="Setting them up in Spark." />
        ) : null}
        {flow.step === "success" ? (
          <SuccessStep
            count={flow.selectedAccountIds.size}
            onDone={flow.handleClose}
            onAnother={flow.handleRetry}
          />
        ) : null}
        {flow.step === "error" && flow.error ? (
          <ErrorStep
            title={
              flow.error.title ??
              (flow.error.recoverable ? "Let's try that again" : "We couldn't connect")
            }
            description={
              flow.error.description ??
              (flow.error.recoverable
                ? "Your bank needs you to approve access again."
                : "Something went wrong connecting your bank.")
            }
            message={flow.error.message}
            retryLabel={flow.error.recoverable ? "Reconnect" : "Try again"}
            onRetry={flow.handleRetry}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function StepHeading({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-foreground text-xl font-medium">{title}</h2>
      <p className="text-muted-foreground mt-1 text-[0.9375rem]">{description}</p>
    </div>
  );
}

const START_STEPS = [
  { icon: Landmark, title: "Choose your bank", body: "Hundreds of UK banks and card providers." },
  {
    icon: MousePointerClick,
    title: "Approve in your bank's app",
    body: "You log in with your bank, never with Spark.",
  },
  {
    icon: Check,
    title: "Pick the accounts to add",
    body: "Current accounts, savings and credit cards.",
  },
] as const;

function StartStep({ onStart }: { onStart: () => void }) {
  return (
    <div className="space-y-6">
      <SparkAppIcon className="size-11" />
      <StepHeading
        title="Connect a bank or card"
        description="It takes about a minute, and you can disconnect at any time."
      />
      <ol className="space-y-4">
        {START_STEPS.map((step) => (
          <li key={step.title} className="flex gap-3">
            <span className="bg-accent text-accent-foreground flex size-9 shrink-0 items-center justify-center rounded-full">
              <step.icon className="size-4" />
            </span>
            <span>
              <span className="text-foreground block text-sm font-semibold">{step.title}</span>
              <span className="text-muted-foreground block text-sm">{step.body}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="bg-muted/70 flex gap-3 rounded-xl p-4 text-sm">
        <ShieldCheck className="text-success mt-0.5 size-5 shrink-0" />
        <p className="text-muted-foreground">
          <span className="text-foreground font-medium">Read-only Open Banking.</span> Spark uses
          TrueLayer, a regulated provider, to see balances and transactions. It never sees your bank
          login and can't move money.
        </p>
      </div>
      <Button size="lg" className="w-full" onClick={onStart}>
        <Lock />
        Choose your bank
      </Button>
    </div>
  );
}

function LoadingStep({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center" role="status">
      <Loader2 className="text-primary size-8 animate-spin" />
      <StepHeading title={title} description={description} />
    </div>
  );
}

function SelectAccountsStep({
  accounts,
  selected,
  onToggle,
  onSelectAll,
  onSave,
}: {
  accounts: Account[];
  selected: Set<string>;
  onToggle: (accountId: string) => void;
  onSelectAll: () => void;
  onSave: () => void;
}) {
  const allSelected = selected.size === accounts.length;
  return (
    <div className="space-y-5">
      <StepHeading
        title="Choose accounts to add"
        description="Only the accounts you pick are synced. You can remove any later."
      />
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {selected.size} of {accounts.length} selected
        </span>
        <Button variant="ghost" size="sm" onClick={onSelectAll}>
          {allSelected ? "Deselect all" : "Select all"}
        </Button>
      </div>
      <ul className="max-h-80 space-y-2 overflow-y-auto">
        {accounts.map((account) => {
          const checked = selected.has(account.accountId);
          const type = formatAccountType(account.accountType);
          const number = formatAccountNumber(account);
          return (
            <li key={account.accountId}>
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors",
                  checked ? "border-primary/50 bg-accent/60" : "hover:bg-muted",
                )}
              >
                <Checkbox checked={checked} onCheckedChange={() => onToggle(account.accountId)} />
                <BankLogo provider={account.provider} />
                <span className="min-w-0 flex-1">
                  <span className="text-foreground block truncate text-sm font-semibold">
                    {account.displayName}
                  </span>
                  <span className="text-muted-foreground block truncate text-xs capitalize">
                    {[type, number].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="text-muted-foreground text-xs">{account.currency}</span>
              </label>
            </li>
          );
        })}
      </ul>
      <Button size="lg" className="w-full" onClick={onSave} disabled={selected.size === 0}>
        Add {selected.size} {selected.size === 1 ? "account" : "accounts"}
      </Button>
    </div>
  );
}

function SuccessStep({
  count,
  onDone,
  onAnother,
}: {
  count: number;
  onDone: () => void;
  onAnother: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-5 py-6 text-center">
      <span className="bg-success/12 text-success inline-flex size-14 items-center justify-center rounded-full">
        <Check className="size-7" />
      </span>
      <StepHeading
        title="You're all set"
        description={`${count} ${count === 1 ? "account" : "accounts"} added. Balances appear in a minute; your transaction history follows shortly after.`}
      />
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
        <Button size="lg" onClick={onDone}>
          Go to Home
        </Button>
        <Button size="lg" variant="outline" onClick={onAnother}>
          Connect another
        </Button>
      </div>
    </div>
  );
}

function ErrorStep({
  title,
  description,
  message,
  retryLabel,
  onRetry,
}: {
  title: string;
  description: string;
  message: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <div className="space-y-5">
      <span className="bg-destructive/10 text-destructive inline-flex size-12 items-center justify-center rounded-full">
        <AlertTriangle className="size-6" />
      </span>
      <StepHeading title={title} description={description} />
      <p className="bg-muted/70 text-muted-foreground rounded-xl p-4 text-sm">{message}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button size="lg" onClick={onRetry}>
          {retryLabel}
        </Button>
        <Link to="/accounts" className={cn(buttonVariants({ size: "lg", variant: "outline" }))}>
          Back to accounts
        </Link>
      </div>
    </div>
  );
}
