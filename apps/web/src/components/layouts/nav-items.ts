import { ArrowLeftRight, House, Landmark, Settings, type LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: "/dashboard" | "/accounts" | "/transactions" | "/settings";
  icon: LucideIcon;
}

/** Primary destinations, in top-bar and mobile tab-bar order. */
export const navItems: readonly NavItem[] = [
  { label: "Home", href: "/dashboard", icon: House },
  { label: "Accounts", href: "/accounts", icon: Landmark },
  { label: "Transactions", href: "/transactions", icon: ArrowLeftRight },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function isActivePath(pathname: string, href: NavItem["href"]): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
