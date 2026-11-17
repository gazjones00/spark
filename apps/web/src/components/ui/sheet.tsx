import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/** A panel that slides in from the right edge: details without leaving the page. */
function Sheet({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetContent({ className, children, ...props }: DialogPrimitive.Popup.Props) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop
        data-slot="sheet-overlay"
        className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0"
      />
      <DialogPrimitive.Popup
        data-slot="sheet-content"
        className={cn(
          "bg-card fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-md flex-col border-l shadow-2xl outline-none transition-transform duration-300 ease-out data-[ending-style]:translate-x-full data-[starting-style]:translate-x-full sm:rounded-l-2xl",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 absolute top-4 right-4 inline-flex size-8 items-center justify-center rounded-lg outline-none focus-visible:ring-[3px]">
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("grid gap-1 px-6 pt-6 pr-14", className)}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="sheet-title"
      className={cn("font-display text-foreground text-lg font-medium", className)}
      {...props}
    />
  );
}

function SheetDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle };
