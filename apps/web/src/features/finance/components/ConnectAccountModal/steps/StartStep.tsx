import { Check, ExternalLink, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface StartStepProps {
  onStart: () => void;
}

export function StartStep({ onStart }: StartStepProps) {
  return (
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
              <p className="text-muted-foreground text-xs">Choose from hundreds of UK banks</p>
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
        <Button onClick={onStart} className="w-full">
          Continue to Bank Selection
        </Button>
      </DialogFooter>
    </>
  );
}
