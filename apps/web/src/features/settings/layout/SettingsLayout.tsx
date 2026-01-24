import { Link, useLocation } from "@tanstack/react-router";
import { User, Lock, Bell, SlidersHorizontal, Landmark, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/settings", label: "Profile", icon: User },
  { href: "/settings/security", label: "Security", icon: Lock },
  { href: "/settings/notifications", label: "Notifications", icon: Bell },
  { href: "/settings/preferences", label: "Preferences", icon: SlidersHorizontal },
  { href: "/settings/accounts", label: "Connected Accounts", icon: Landmark },
  { href: "/settings/danger-zone", label: "Danger Zone", icon: AlertTriangle },
];

export function SettingsLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">Manage your account and preferences</p>
      </div>

      <div className="flex flex-col gap-6 md:flex-row">
        <nav className="flex w-full flex-row gap-1 overflow-x-auto md:w-52 md:flex-col">
          {tabs.map((tab) => {
            const isActive = location.pathname === tab.href;
            return (
              <Link
                key={tab.href}
                to={tab.href}
                className={cn(
                  "flex items-center gap-2 rounded-none px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <tab.icon className="size-4" />
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
