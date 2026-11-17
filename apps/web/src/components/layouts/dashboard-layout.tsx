import * as React from "react";

import { Link, useLocation } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { SparkLines } from "@/components/spark-lines";
import { SparkLogo, SparkMark } from "@/components/spark-mark";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isActivePath, navItems, type NavItem } from "./nav-items";
import { UserMenu } from "./user-menu";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="relative isolate flex min-h-svh flex-col">
      {/* Signature lines, faint, behind the top-right of every page. */}
      <SparkLines className="absolute top-0 right-0 -z-10 hidden h-[560px] [--lines-lit:color-mix(in_oklab,var(--primary)_55%,transparent)] w-[min(1100px,80vw)] [mask-image:radial-gradient(75%_80%_at_85%_10%,black,transparent)] md:block" />
      <MobileTopBar />
      <DesktopTopBar />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 pt-5 pb-28 sm:px-6 md:pt-4 md:pb-12 lg:px-10">
          {children}
        </div>
      </main>
      <MobileTabBar />
    </div>
  );
}

const primaryNav = navItems.filter((item) => item.href !== "/settings");
const settingsNav = navItems.filter((item) => item.href === "/settings");

/**
 * Desktop top bar: three grouped panels — the mark, the sections (Settings
 * set apart at the far end), and the main action with the account menu.
 */
function DesktopTopBar() {
  const location = useLocation();
  const renderItem = (item: NavItem) => (
    <TopNavLink key={item.href} item={item} active={isActivePath(location.pathname, item.href)} />
  );

  return (
    <header className="bg-background/80 sticky top-0 z-30 hidden backdrop-blur-md md:block">
      <div className="mx-auto flex h-[4.5rem] w-full max-w-6xl items-center gap-2 px-6 lg:px-10">
        <Link
          to="/dashboard"
          aria-label="Spark home"
          className="bg-card hover:bg-accent focus-visible:ring-ring/50 flex size-11 shrink-0 items-center justify-center rounded-lg border outline-none focus-visible:ring-[3px]"
        >
          <SparkMark className="size-6" />
        </Link>

        <nav
          aria-label="Main"
          className="bg-card flex h-11 min-w-0 flex-1 items-center justify-between gap-1 rounded-lg border p-1"
        >
          <div className="flex items-center gap-1">{primaryNav.map(renderItem)}</div>
          <div className="flex items-center gap-1">{settingsNav.map(renderItem)}</div>
        </nav>

        <div className="bg-card flex h-11 shrink-0 items-center gap-1 rounded-lg border p-1">
          <Link
            to="/accounts/connect"
            className={cn(buttonVariants({ size: "sm" }), "h-[2.125rem] px-3.5")}
          >
            <Plus />
            Connect account
          </Link>
          <UserMenu compact />
        </div>
      </div>
    </header>
  );
}

function TopNavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      to={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "focus-visible:ring-ring/50 flex h-[2.125rem] items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px]",
        active
          ? "bg-secondary text-foreground border-transparent"
          : "text-muted-foreground hover:bg-accent hover:text-foreground border-transparent",
      )}
    >
      <item.icon className={cn("size-4", active ? "text-primary" : "opacity-80")} />
      {item.label}
    </Link>
  );
}

/** Brand + account menu on small screens; the top bar takes over from `md`. */
function MobileTopBar() {
  return (
    <header className="bg-background/85 border-border sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b px-4 backdrop-blur md:hidden">
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
