import * as React from "react";

import { DashboardSidebar } from "./dashboard-sidebar";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex h-svh">
      <DashboardSidebar />
      <main className="flex-1 overflow-auto bg-muted/30">
        <div className="container mx-auto max-w-6xl p-6">{children}</div>
      </main>
    </div>
  );
}
