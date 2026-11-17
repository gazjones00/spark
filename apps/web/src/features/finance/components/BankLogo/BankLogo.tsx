import { ProviderLogo } from "@/components/provider-logo";
import { cn } from "@/lib/utils";
import type { Account } from "@spark/orpc/contract";

/** The bank's logo on a neutral tile, or its initial when there is none. */
export function BankLogo({
  provider,
  className,
}: {
  provider: Account["provider"];
  className?: string;
}) {
  const initial = (provider.displayName ?? "?").charAt(0).toUpperCase();
  return (
    <span
      className={cn(
        "bg-muted border-border inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border",
        className,
      )}
    >
      <ProviderLogo
        logoUri={provider.logoUri}
        alt=""
        className="size-[60%] object-contain"
        fallback={
          <span className="font-display text-muted-foreground text-sm font-bold">{initial}</span>
        }
      />
    </span>
  );
}
