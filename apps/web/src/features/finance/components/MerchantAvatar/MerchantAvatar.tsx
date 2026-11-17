import { cn } from "@/lib/utils";

interface MerchantAvatarProps {
  name: string;
  /** Category colour (a CSS colour or var()). */
  color: string;
  className?: string;
}

/** The merchant's initial on a soft wash of its category colour. */
export function MerchantAvatar({ name, color, className }: MerchantAvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase() || "•";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "font-display relative inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold",
        className,
      )}
      style={{ color }}
    >
      <span className="absolute inset-0 opacity-[0.14]" style={{ backgroundColor: color }} />
      <span className="relative">{initial}</span>
    </span>
  );
}
