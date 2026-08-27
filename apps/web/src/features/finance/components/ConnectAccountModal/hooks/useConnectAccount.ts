import * as React from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@spark/orpc";
import type { Account } from "@spark/truelayer/types";
import { describeCallbackError, describeConnectError, type ConnectErrorDetail } from "../utils";

export type Step = "start" | "loading" | "select-accounts" | "saving" | "success" | "error";

interface UseConnectAccountOptions {
  onSuccess?: () => void;
}

export function useConnectAccount(options?: UseConnectAccountOptions) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = useSearch({ strict: false }) as {
    code?: string;
    state?: string;
    error?: string;
  };

  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<Step>("start");
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = React.useState<Set<string>>(new Set());
  const [oauthState, setOauthState] = React.useState<string | null>(null);
  const [error, setError] = React.useState<ConnectErrorDetail | null>(null);

  const handleMutationError = React.useCallback((failure: unknown) => {
    setError(describeConnectError(failure));
    setStep("error");
  }, []);

  const generateAuthLinkMutation = useMutation({
    mutationFn: () => orpc.truelayer.generateAuthLink.call({}),
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: handleMutationError,
  });

  const exchangeCodeMutation = useMutation({
    mutationFn: ({ code, state }: { code: string; state: string }) =>
      orpc.truelayer.exchangeCode.call({ code, state }),
    onSuccess: (data) => {
      setAccounts(data.accounts);
      setSelectedAccountIds(new Set(data.accounts.map((a) => a.accountId)));
      setOauthState(data.state);
      setStep("select-accounts");
    },
    onError: handleMutationError,
  });

  const saveAccountsMutation = useMutation({
    mutationFn: () => {
      if (!oauthState) throw new Error("No OAuth state");
      return orpc.truelayer.saveAccounts.call({
        state: oauthState,
        accountIds: Array.from(selectedAccountIds),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setStep("success");
    },
    onError: handleMutationError,
  });

  React.useEffect(() => {
    if (open) return;

    const showError = (detail: ConnectErrorDetail) => {
      setOpen(true);
      setError(detail);
      setStep("error");
    };

    if (search.error) {
      // The consent journey ended without a code — usually a user cancel.
      showError(describeCallbackError(search.error));
    } else if (search.code && search.state) {
      setOpen(true);
      setStep("loading");
      exchangeCodeMutation.mutate({ code: search.code, state: search.state });
    } else if (search.code) {
      // Missing state parameter - potential CSRF attack
      showError({
        message: "Invalid authorization response: missing state parameter",
        recoverable: false,
      });
    } else {
      return;
    }

    navigate({ to: "/accounts/connect", search: {}, replace: true });
  }, [search.code, search.state, search.error, open, navigate]);

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
      options?.onSuccess?.();
    }
    setTimeout(() => {
      setStep("start");
      setAccounts([]);
      setSelectedAccountIds(new Set());
      setOauthState(null);
      setError(null);
    }, 200);
  };

  const handleRetry = () => {
    setStep("start");
  };

  return {
    open,
    setOpen,
    step,
    accounts,
    selectedAccountIds,
    error,
    handleStartConnection,
    handleAccountToggle,
    handleSelectAll,
    handleSaveAccounts,
    handleClose,
    handleRetry,
  };
}
