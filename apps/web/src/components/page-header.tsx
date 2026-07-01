import * as React from "react";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  /** Bracketed mono label above the title, e.g. "Overview". */
  eyebrow: string;
  title: string;
  description?: React.ReactNode;
  /** Right-aligned slot for page-level actions. */
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({ eyebrow, title, description, action, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div>
        <p className="eyebrow text-muted-foreground">{eyebrow}</p>
        <h1 className="headline mt-2 text-3xl sm:text-4xl">{title}</h1>
        {description ? <p className="text-muted-foreground mt-2 text-sm">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
