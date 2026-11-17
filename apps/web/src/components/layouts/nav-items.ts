import { ArrowLeftRight, House, Landmark, Settings, Wand2, type LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: "/dashboard" | "/accounts" | "/transactions" | "/rules" | "/settings";
  icon: LucideIcon;
}

/** Primary destinations, in sidebar and mobile tab-bar order. */
export const navItems: readonly NavItem[] = [
  { label: "Home", href: "/dashboard", icon: House },
  { label: "Accounts", href: "/accounts", icon: Landmark },
  { label: "Transactions", href: "/transactions", icon: ArrowLeftRight },
  { label: "Rules", href: "/rules", icon: Wand2 },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function isActivePath(pathname: string, href: NavItem["href"]): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
