import * as React from "react";
import { Check, Loader2, ExternalLink, Building2 } from "lucide-react";
import { useNavigate, useSearch } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { orpc } from "@spark/orpc";
import { useMutation } from "@tanstack/react-query";

interface TrueLayerAccount {
  accountId: string;
  displayName: string;
  accountType?: string;
  currency: string;
  accountNumber: {
    number?: string;
    sortCode?: string;
    iban?: string;
  };
  provider: {
    providerId?: string;
    displayName?: string;
  };
}

type Step = "start" | "loading" | "select-accounts" | "saving" | "success" | "error";

interface ConnectAccountModalProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function ConnectAccountModal({ trigger, onSuccess }: ConnectAccountModalProps) {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { code?: string; state?: string };
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<Step>("start");
  const [accounts, setAccounts] = React.useState<TrueLayerAccount[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = React.useState<Set<string>>(new Set());
  const [tokenData, setTokenData] = React.useState<{
    accessToken: string;
    refreshToken: string | null;
    expiresAt: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string>("");

  const generateAuthLinkMutation = useMutation({
    mutationFn: () => orpc.truelayer.generateAuthLink.call({}),
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (error) => {
      setErrorMessage(error.message);
      setStep("error");
    },
  });

  const exchangeCodeMutation = useMutation({
    mutationFn: (code: string) => orpc.truelayer.exchangeCode.call({ code }),
    onSuccess: (data) => {
      setAccounts(data.accounts);
      setSelectedAccountIds(new Set(data.accounts.map((a) => a.accountId)));
      setTokenData({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt,
      });
      setStep("select-accounts");
    },
    onError: (error) => {
      setErrorMessage(error.message);
      setStep("error");
    },
  });

  const saveAccountsMutation = useMutation({
    mutationFn: () => {
      if (!tokenData) throw new Error("No token data");
      return orpc.truelayer.saveAccounts.call({
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken,
        expiresAt: tokenData.expiresAt,
        accountIds: Array.from(selectedAccountIds),
      });
    },
    onSuccess: () => {
      setStep("success");
    },
    onError: (error) => {
      setErrorMessage(error.message);
      setStep("error");
    },
  });

  React.useEffect(() => {
    if (search.code && !open) {
      setOpen(true);
      setStep("loading");
      exchangeCodeMutation.mutate(search.code);
      navigate({ to: "/accounts/connect", search: {}, replace: true });
    }
  }, [search.code, open, navigate]);

  const handleStartConnection = () => {
    setStep("loading");
    generateAuthLinkMutation.mutate();
  };

  const handleAccountToggle = (accountId: string) => {
    setSelectedAccountIds((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedAccountIds.size === accounts.length) {
      setSelectedAccountIds(new Set());
    } else {
      setSelectedAccountIds(new Set(accounts.map((a) => a.accountId)));
    }
  };

  const handleSaveAccounts = () => {
    setStep("saving");
    saveAccountsMutation.mutate();
  };

  const handleClose = () => {
    setOpen(false);
    if (step === "success") {
      onSuccess?.();
    }
    setTimeout(() => {
      setStep("start");
      setAccounts([]);
      setSelectedAccountIds(new Set());
      setTokenData(null);
      setErrorMessage("");
    }, 200);
  };

  const formatAccountNumber = (account: TrueLayerAccount) => {
    if (account.accountNumber.number && account.accountNumber.sortCode) {
      return `${account.accountNumber.sortCode} ${account.accountNumber.number}`;
    }
    if (account.accountNumber.iban) {
      return `IBAN: ...${account.accountNumber.iban.slice(-4)}`;
    }
    return null;
  };

  const formatAccountType = (type?: string) => {
    if (!type) return null;
    return type.replace(/_/g, " ").toLowerCase();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>{trigger || <Button>Connect Account</Button>}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {step === "start" && (
          <>
            <DialogHeader>
              <DialogTitle>Connect Your Bank</DialogTitle>
              <DialogDescription>
                Securely connect your bank account using TrueLayer's Open Banking integration.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="bg-muted flex size-8 shrink-0 items-center justify-center">
                    <Building2 className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Select your bank</p>
                    <p className="text-muted-foreground text-xs">
                      Choose from hundreds of UK banks
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-muted flex size-8 shrink-0 items-center justify-center">
                    <ExternalLink className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Authorize access</p>
                    <p className="text-muted-foreground text-xs">Log in securely with your bank</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-muted flex size-8 shrink-0 items-center justify-center">
                    <Check className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Choose accounts</p>
                    <p className="text-muted-foreground text-xs">Select which accounts to import</p>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleStartConnection} className="w-full">
                Continue to Bank Selection
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "loading" && (
          <>
            <DialogHeader>
              <DialogTitle>Connecting...</DialogTitle>
              <DialogDescription>Please wait while we connect to your bank.</DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-8 animate-spin" />
            </div>
          </>
        )}

        {step === "select-accounts" && (
          <>
            <DialogHeader>
              <DialogTitle>Select Accounts</DialogTitle>
              <DialogDescription>Choose which accounts you want to add to Spark.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-muted-foreground text-xs">
                  {selectedAccountIds.size} of {accounts.length} selected
                </span>
                <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                  {selectedAccountIds.size === accounts.length ? "Deselect All" : "Select All"}
                </Button>
              </div>
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {accounts.map((account) => (
                  <label
                    key={account.accountId}
                    className="flex cursor-pointer items-center gap-3 border p-3 transition-colors hover:bg-muted"
                  >
                    <Checkbox
                      checked={selectedAccountIds.has(account.accountId)}
                      onCheckedChange={() => handleAccountToggle(account.accountId)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{account.displayName}</p>
                      <div className="text-muted-foreground flex items-center gap-2 text-xs">
                        {formatAccountType(account.accountType) && (
                          <span className="capitalize">
                            {formatAccountType(account.accountType)}
                          </span>
                        )}
                        {formatAccountNumber(account) && (
                          <>
                            <span>-</span>
                            <span>{formatAccountNumber(account)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="text-muted-foreground text-xs">{account.currency}</span>
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleSaveAccounts}
                disabled={selectedAccountIds.size === 0}
                className="w-full"
              >
                Add {selectedAccountIds.size} Account{selectedAccountIds.size !== 1 ? "s" : ""}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "saving" && (
          <>
            <DialogHeader>
              <DialogTitle>Saving Accounts...</DialogTitle>
              <DialogDescription>Adding your selected accounts to Spark.</DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-8 animate-spin" />
            </div>
          </>
        )}

        {step === "success" && (
          <>
            <DialogHeader>
              <DialogTitle>Accounts Added!</DialogTitle>
              <DialogDescription>
                Your bank accounts have been successfully connected.
              </DialogDescription>
            </DialogHeader>
            <div className="py-6 text-center">
              <div className="bg-chart-3/20 mx-auto mb-4 flex size-16 items-center justify-center rounded-full">
                <Check className="text-chart-3 size-8" />
              </div>
              <p className="text-muted-foreground text-sm">
                {selectedAccountIds.size} account{selectedAccountIds.size !== 1 ? "s" : ""} added
                successfully
              </p>
            </div>
            <DialogFooter>
              <Button onClick={handleClose} className="w-full">
                Done
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "error" && (
          <>
            <DialogHeader>
              <DialogTitle>Connection Failed</DialogTitle>
              <DialogDescription>
                There was an error connecting your bank account.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <p className="text-destructive text-sm">{errorMessage}</p>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={() => setStep("start")}>Try Again</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
