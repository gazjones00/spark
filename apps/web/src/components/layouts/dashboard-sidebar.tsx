import { Link, useLocation } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { SparkLogo } from "@/components/spark-mark";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isActivePath, navItems } from "./nav-items";
import { UserMenu } from "./user-menu";

export function DashboardSidebar() {
  const location = useLocation();
  const primary = navItems.filter((item) => item.href !== "/settings");
  const settings = navItems.filter((item) => item.href === "/settings");

  const renderItem = (item: (typeof navItems)[number]) => {
    const active = isActivePath(location.pathname, item.href);
    return (
      <Link
        key={item.href}
        to={item.href}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <item.icon className={cn("size-[18px]", active ? "text-primary" : "opacity-80")} />
        {item.label}
      </Link>
    );
  };

  return (
    <aside className="bg-sidebar border-sidebar-border hidden h-full w-64 shrink-0 flex-col border-r md:flex">
      <div className="flex h-16 items-center px-5">
        <Link to="/dashboard" aria-label="Spark home">
          <SparkLogo />
        </Link>
      </div>

      <div className="px-3 pt-1">
        <Link
          to="/accounts/connect"
          className={cn(buttonVariants({ variant: "default" }), "w-full")}
        >
          <Plus />
          Connect account
        </Link>
      </div>

      <nav aria-label="Main" className="flex-1 space-y-0.5 px-3 py-5">
        {primary.map(renderItem)}
      </nav>

      <div className="space-y-1 px-3 pb-3">
        {settings.map(renderItem)}
        <div className="border-sidebar-border mt-2 border-t pt-3">
          <UserMenu />
        </div>
      </div>
    </aside>
  );
}
