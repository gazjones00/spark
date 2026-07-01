import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ErrorStepProps {
  message: string;
  /** True when restarting the connect flow fixes it (expired session, reauth). */
  recoverable?: boolean;
  onClose: () => void;
  onRetry: () => void;
}

export function ErrorStep({ message, recoverable = false, onClose, onRetry }: ErrorStepProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>{recoverable ? "Reconnection Needed" : "Connection Failed"}</DialogTitle>
        <DialogDescription>
          {recoverable
            ? "Your bank needs you to authorise this connection again."
            : "There was an error connecting your bank account."}
        </DialogDescription>
      </DialogHeader>
      <div className="py-4">
        <p className="text-destructive text-sm">{message}</p>
      </div>
      <DialogFooter className="gap-2 sm:gap-0">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={onRetry}>{recoverable ? "Reconnect" : "Try Again"}</Button>
      </DialogFooter>
    </>
  );
}
