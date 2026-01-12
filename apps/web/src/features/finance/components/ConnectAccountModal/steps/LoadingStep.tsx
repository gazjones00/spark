import { Loader2 } from "lucide-react";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface LoadingStepProps {
  title: string;
  description: string;
}

export function LoadingStep({ title, description }: LoadingStepProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-8 animate-spin" />
      </div>
    </>
  );
}
