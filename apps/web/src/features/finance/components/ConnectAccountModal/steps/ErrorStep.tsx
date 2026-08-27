import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ErrorStepProps {
  message: string;
  /** True when restarting the connect flow fixes it (expired session, reauth). */
  recoverable?: boolean;
  /** Overrides the default heading/subheading, e.g. for a user-cancelled flow. */
  title?: string;
  description?: string;
  onClose: () => void;
  onRetry: () => void;
}

export function ErrorStep({
  message,
  recoverable = false,
  title,
  description,
  onClose,
  onRetry,
}: ErrorStepProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {title ?? (recoverable ? "Reconnection Needed" : "Connection Failed")}
        </DialogTitle>
        <DialogDescription>
          {description ??
            (recoverable
              ? "Your bank needs you to authorise this connection again."
              : "There was an error connecting your bank account.")}
        </DialogDescription>
      </DialogHeader>
      <div className="py-4">
        <p className="text-destructive text-sm">{message}</p>
      </div>
      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={onRetry}>{recoverable ? "Reconnect" : "Try Again"}</Button>
      </DialogFooter>
    </>
  );
}
