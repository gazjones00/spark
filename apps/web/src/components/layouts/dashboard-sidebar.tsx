import { Link, useLocation } from "@tanstack/react-router";
import { LayoutDashboard, Landmark, Receipt, Plus, LogOut, Settings } from "lucide-react";

import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@spark/auth/react";
import { useNavigate } from "@tanstack/react-router";

const navItems = [
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
];

export function DashboardSidebar() {
  const location = useLocation();
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <aside className="bg-card border-r flex h-full w-64 flex-col">
      <div className="flex h-14 items-center border-b px-4">
        <Link to="/dashboard" className="flex items-center gap-2">
          <span className="text-lg font-bold">Spark</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 rounded-none px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}

        <Separator className="my-4" />

        <Link
          to="/accounts/connect"
          className="flex items-center gap-3 rounded-none px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Plus className="size-4" />
          Connect Account
        </Link>
      </nav>

      <div className="border-t p-4 space-y-1">
        <button
          className="flex w-full items-center gap-3 rounded-none px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          onClick={() => {}}
        >
          <Settings className="size-4" />
          Settings
        </button>
        <button
          className="cursor-pointer flex w-full items-center gap-3 rounded-none px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          onClick={() => logout().then(() => navigate({ to: "/login" }))}
        >
          <LogOut className="size-4" />
          Log out
        </button>
      </div>
    </aside>
  );
}
