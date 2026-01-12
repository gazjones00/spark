import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface SuccessStepProps {
  count: number;
  onClose: () => void;
}

export function SuccessStep({ count, onClose }: SuccessStepProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Accounts Added!</DialogTitle>
        <DialogDescription>Your bank accounts have been successfully connected.</DialogDescription>
      </DialogHeader>
      <div className="py-6 text-center">
        <div className="bg-chart-3/20 mx-auto mb-4 flex size-16 items-center justify-center rounded-full">
          <Check className="text-chart-3 size-8" />
        </div>
        <p className="text-muted-foreground text-sm">
          {count} account{count !== 1 ? "s" : ""} added successfully
        </p>
      </div>
      <DialogFooter>
        <Button onClick={onClose} className="w-full">
          Done
        </Button>
      </DialogFooter>
    </>
  );
}
