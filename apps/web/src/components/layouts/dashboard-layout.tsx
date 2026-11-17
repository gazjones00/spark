import * as React from "react";

import { Link, useLocation } from "@tanstack/react-router";

import { SparkLogo } from "@/components/spark-mark";
import { cn } from "@/lib/utils";
import { DashboardSidebar } from "./dashboard-sidebar";
import { isActivePath, navItems } from "./nav-items";
import { UserMenu } from "./user-menu";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex h-svh flex-col md:flex-row">
      <MobileTopBar />
      <DashboardSidebar />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-6xl px-4 pt-5 pb-28 sm:px-6 md:pb-10 lg:px-10 lg:pt-8">
          {children}
        </div>
      </main>
      <MobileTabBar />
    </div>
  );
}

/** Brand + account menu on small screens; the sidebar takes over from `md`. */
function MobileTopBar() {
  return (
    <header className="bg-card/90 border-border sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b px-4 backdrop-blur md:hidden">
      <Link to="/dashboard" aria-label="Spark home">
        <SparkLogo markClassName="size-5" className="[&>span:last-child]:text-lg" />
      </Link>
      <UserMenu compact />
    </header>
  );
}

/** Bottom tab bar: every primary destination one thumb-tap away. */
function MobileTabBar() {
  const location = useLocation();
  return (
    <nav
      aria-label="Main"
      className="bg-card/95 border-border fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-4">
        {navItems.map((item) => {
          const active = isActivePath(location.pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                to={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <item.icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
