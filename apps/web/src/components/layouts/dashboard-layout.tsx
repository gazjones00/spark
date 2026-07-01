import * as React from "react";

import { Link, useLocation } from "@tanstack/react-router";
import { Settings } from "lucide-react";

import { cn } from "@/lib/utils";
import { SparkMark } from "@/components/spark-mark";
import { DashboardSidebar, navItems } from "./dashboard-sidebar";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex h-svh flex-col md:flex-row">
      <MobileTopBar />
      <DashboardSidebar />
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}

/** Compact rail for small screens — the sidebar is hidden below `md`. */
function MobileTopBar() {
  const location = useLocation();

  return (
    <div className="bg-sidebar text-sidebar-foreground border-sidebar-border border-b md:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <Link to="/dashboard" className="flex items-center gap-2">
          <SparkMark className="size-5" />
          <span className="font-display text-sidebar-accent-foreground text-sm font-semibold tracking-[0.12em]">
            SPARK
          </span>
        </Link>
        <Link
          to="/settings"
          aria-label="Settings"
          className={cn(
            "p-2 transition-colors",
            location.pathname.startsWith("/settings")
              ? "text-sidebar-primary"
              : "text-sidebar-foreground hover:text-sidebar-accent-foreground",
          )}
        >
          <Settings className="size-4" />
        </Link>
      </div>
      <nav className="flex items-center gap-1 overflow-x-auto px-2 pb-2">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-2 border-b-2 px-3 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] whitespace-nowrap transition-colors",
                isActive
                  ? "border-sidebar-primary text-sidebar-accent-foreground"
                  : "border-transparent text-sidebar-foreground hover:text-sidebar-accent-foreground",
              )}
            >
              <item.icon className={cn("size-3.5", isActive && "text-sidebar-primary")} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
