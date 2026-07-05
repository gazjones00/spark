import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Landmark, Receipt, Wand2, Plus, LogOut, Settings } from "lucide-react";

import { cn } from "@/lib/utils";
import { SparkMark } from "@/components/spark-mark";
import { useAuth } from "@spark/auth/react";

export const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Accounts",
    href: "/accounts",
    icon: Landmark,
  },
  {
    label: "Transactions",
    href: "/transactions",
    icon: Receipt,
  },
  {
    label: "Rules",
    href: "/rules",
    icon: Wand2,
  },
] as const;

function navLinkClass(isActive: boolean) {
  return cn(
    "flex items-center gap-3 border-l-2 px-3 py-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] transition-colors",
    isActive
      ? "border-sidebar-primary bg-sidebar-accent text-sidebar-accent-foreground"
      : "border-transparent text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
  );
}

export function DashboardSidebar() {
  const location = useLocation();
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border hidden h-full w-60 flex-col border-r md:flex">
      <div className="border-sidebar-border flex h-16 items-center border-b px-5">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <SparkMark className="size-5" />
          <span className="font-display text-sidebar-accent-foreground text-base font-semibold tracking-[0.12em]">
            SPARK
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-5">
        <p className="eyebrow mb-3 px-3 text-[10px] text-[#747576]">Ledger</p>
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.href);
          return (
            <Link key={item.href} to={item.href} className={navLinkClass(isActive)}>
              <item.icon
                className={cn("size-4", isActive ? "text-sidebar-primary" : "text-[#747576]")}
              />
              {item.label}
            </Link>
          );
        })}

        <Link
          to="/accounts/connect"
          className="border-sidebar-border text-sidebar-foreground hover:border-sidebar-primary/60 hover:text-sidebar-accent-foreground mt-6 flex items-center gap-3 border border-dashed px-3 py-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] transition-colors"
        >
          <Plus className="text-sidebar-primary size-4" />
          Connect account
        </Link>
      </nav>

      <div className="border-sidebar-border space-y-1 border-t px-3 py-4">
        <Link to="/settings" className={navLinkClass(location.pathname.startsWith("/settings"))}>
          <Settings
            className={cn(
              "size-4",
              location.pathname.startsWith("/settings") ? "text-sidebar-primary" : "text-[#747576]",
            )}
          />
          Settings
        </Link>
        <button
          className="flex w-full cursor-pointer items-center gap-3 border-l-2 border-transparent px-3 py-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-sidebar-foreground transition-colors hover:bg-[#fe4d4d]/10 hover:text-[#fe4d4d]"
          onClick={() => logout().then(() => navigate({ to: "/login" }))}
        >
          <LogOut className="size-4 text-[#747576]" />
          Log out
        </button>
      </div>
    </aside>
  );
}
