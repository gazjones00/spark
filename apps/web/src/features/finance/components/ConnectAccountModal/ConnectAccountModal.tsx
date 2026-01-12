import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useConnectAccount } from "./hooks/useConnectAccount";
import { StartStep } from "./steps/StartStep";
import { LoadingStep } from "./steps/LoadingStep";
import { SelectAccountsStep } from "./steps/SelectAccountsStep";
import { SuccessStep } from "./steps/SuccessStep";
import { ErrorStep } from "./steps/ErrorStep";

export interface ConnectAccountModalProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function ConnectAccountModal({ trigger, onSuccess }: ConnectAccountModalProps) {
  const {
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
  } = useConnectAccount({ onSuccess });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>{trigger || <Button>Connect Account</Button>}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {step === "start" && <StartStep onStart={handleStartConnection} />}

        {step === "loading" && (
          <LoadingStep
            title="Connecting..."
            description="Please wait while we connect to your bank."
          />
        )}

        {step === "select-accounts" && (
          <SelectAccountsStep
            accounts={accounts}
            selectedAccountIds={selectedAccountIds}
            onToggle={handleAccountToggle}
            onSelectAll={handleSelectAll}
            onSave={handleSaveAccounts}
          />
        )}

        {step === "saving" && (
          <LoadingStep
            title="Saving Accounts..."
            description="Adding your selected accounts to Spark."
          />
        )}

        {step === "success" && (
          <SuccessStep count={selectedAccountIds.size} onClose={handleClose} />
        )}

        {step === "error" && (
          <ErrorStep message={errorMessage} onClose={handleClose} onRetry={handleRetry} />
        )}
      </DialogContent>
    </Dialog>
  );
}
