import { Link, useLocation } from "@tanstack/react-router";
import { User, Lock, Bell, SlidersHorizontal, Landmark, Tag, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";

const tabs = [
  { href: "/settings", label: "Profile", icon: User },
  { href: "/settings/security", label: "Security", icon: Lock },
  { href: "/settings/notifications", label: "Notifications", icon: Bell },
  { href: "/settings/preferences", label: "Preferences", icon: SlidersHorizontal },
  { href: "/settings/categories", label: "Categories", icon: Tag },
  { href: "/settings/accounts", label: "Connected Accounts", icon: Landmark },
  { href: "/settings/danger-zone", label: "Danger Zone", icon: AlertTriangle },
];

export function SettingsLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Configuration"
        title="Settings"
        description="Manage your account and preferences"
      />

      <div className="flex flex-col gap-6 md:flex-row">
        <nav className="flex w-full flex-row gap-1 overflow-x-auto md:w-52 md:flex-col">
          {tabs.map((tab) => {
            const isActive = location.pathname === tab.href;
            const isDanger = tab.href === "/settings/danger-zone";
            return (
              <Link
                key={tab.href}
                to={tab.href}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.1em] whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-foreground text-background"
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
                <span className="hidden sm:inline">{tab.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
