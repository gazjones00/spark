import { useNavigate } from "@tanstack/react-router";
import { ChevronsUpDown, LogOut, Monitor, Moon, Settings, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { useAuth } from "@spark/auth/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/utils";

function initials(name: string | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function UserAvatar({ name, className }: { name?: string; className?: string }) {
  return (
    <span
      className={cn(
        "bg-accent text-accent-foreground font-display inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

/**
 * Account menu: who's signed in, settings, theme and sign-out. `compact`
 * shows only the avatar (mobile top bar).
 */
export function UserMenu({ compact = false }: { compact?: boolean }) {
  const { user: sessionUser, logout } = useAuth();
  const user = useHydrated() ? sessionUser : null;
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className={cn(
          "hover:bg-muted focus-visible:ring-ring/50 flex items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-[3px]",
          compact ? "p-1" : "w-full px-2 py-2",
        )}
      >
        <UserAvatar name={user?.name} />
        {compact ? null : (
          <>
            <span className="min-w-0 flex-1">
              <span className="text-foreground block truncate text-sm font-medium">
                {user?.name ?? " "}
              </span>
              <span className="text-muted-foreground block truncate text-xs">
                {user?.email ?? " "}
              </span>
            </span>
            <ChevronsUpDown className="text-muted-foreground size-4" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={compact ? "end" : "start"}
        side={compact ? "bottom" : "top"}
        className="w-60"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="truncate">{user?.email}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
          <Settings />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={theme ?? "system"}
            onValueChange={(value) => setTheme(String(value))}
          >
            <DropdownMenuRadioItem value="light">
              <Sun />
              Light
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">
              <Moon />
              Dark
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system">
              <Monitor />
              System
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => logout().then(() => navigate({ to: "/login" }))}
        >
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
