import * as React from "react";

import { Link, useLocation } from "@tanstack/react-router";
import { User, Lock, Bell, SlidersHorizontal, Tag, Wand2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";

const tabs = [
  { href: "/settings", label: "Profile", icon: User },
  { href: "/settings/security", label: "Security", icon: Lock },
  { href: "/settings/notifications", label: "Notifications", icon: Bell },
  { href: "/settings/preferences", label: "Preferences", icon: SlidersHorizontal },
  { href: "/settings/categories", label: "Categories", icon: Tag },
  { href: "/settings/rules", label: "Rules", icon: Wand2 },
  { href: "/settings/danger-zone", label: "Danger zone", icon: AlertTriangle },
];

export function SettingsLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navRef = React.useRef<HTMLElement>(null);

  // The row of tabs scrolls sideways on phones: bring the current one into view.
  React.useEffect(() => {
    const nav = navRef.current;
    const current = nav?.querySelector<HTMLElement>("[data-current]");
    if (!nav || !current) return;
    const offset = current.getBoundingClientRect().left - nav.getBoundingClientRect().left;
    nav.scrollTo({ left: nav.scrollLeft + offset - (nav.clientWidth - current.offsetWidth) / 2 });
  }, [location.pathname]);

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your account and preferences" />

      <div className="flex flex-col gap-6 md:flex-row">
        {/* A scrolling row of labelled tabs on phones, a column from `md`. */}
        <nav
          ref={navRef}
          aria-label="Settings"
          className="-mx-4 flex flex-row gap-1 overflow-x-auto px-4 sm:-mx-6 sm:px-6 md:mx-0 md:w-52 md:shrink-0 md:flex-col md:px-0"
        >
          {tabs.map((tab) => {
            const isActive = location.pathname === tab.href;
            const isDanger = tab.href === "/settings/danger-zone";
            return (
              <Link
                key={tab.href}
                to={tab.href}
                data-current={isActive ? "" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : cn(
                        "text-muted-foreground hover:bg-muted hover:text-foreground",
                        isDanger && "hover:text-destructive",
                      ),
                )}
              >
                <tab.icon
                  className={cn(
                    "size-4",
                    isActive && "text-primary",
                    isDanger && !isActive && "text-destructive/70",
                  )}
                />
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
