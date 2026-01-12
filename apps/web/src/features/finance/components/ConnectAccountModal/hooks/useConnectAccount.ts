import * as React from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@spark/orpc";
import type { Account } from "@spark/truelayer/types";

export type Step = "start" | "loading" | "select-accounts" | "saving" | "success" | "error";

interface TokenData {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string;
}

interface UseConnectAccountOptions {
  onSuccess?: () => void;
}

export function useConnectAccount(options?: UseConnectAccountOptions) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = useSearch({ strict: false }) as { code?: string; state?: string };

  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<Step>("start");
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = React.useState<Set<string>>(new Set());
  const [tokenData, setTokenData] = React.useState<TokenData | null>(null);
  const [errorMessage, setErrorMessage] = React.useState("");

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
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
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
      options?.onSuccess?.();
    }
    setTimeout(() => {
      setStep("start");
      setAccounts([]);
      setSelectedAccountIds(new Set());
      setTokenData(null);
      setErrorMessage("");
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
    errorMessage,
    handleStartConnection,
    handleAccountToggle,
    handleSelectAll,
    handleSaveAccounts,
    handleClose,
    handleRetry,
  };
}
