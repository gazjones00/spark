import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ErrorStepProps {
  message: string;
  onClose: () => void;
  onRetry: () => void;
}

export function ErrorStep({ message, onClose, onRetry }: ErrorStepProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Connection Failed</DialogTitle>
        <DialogDescription>There was an error connecting your bank account.</DialogDescription>
      </DialogHeader>
      <div className="py-4">
        <p className="text-destructive text-sm">{message}</p>
      </div>
      <DialogFooter className="gap-2 sm:gap-0">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={onRetry}>Try Again</Button>
      </DialogFooter>
    </>
  );
}
