import type { ReactNode } from "react";

import { Link } from "@tanstack/react-router";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SparkMark } from "@/components/spark-mark";

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  description: string;
}

export function AuthLayout({ children, title, description }: AuthLayoutProps) {
  return (
    <div className="bg-dotgrid flex min-h-svh items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <Link to="/" aria-label="Back to the Spark homepage">
            <SparkMark className="size-8" />
          </Link>
          <span className="font-display text-lg font-semibold tracking-[0.12em]">SPARK</span>
        </div>
        <Card>
          <CardHeader className="gap-2 text-center">
            <CardTitle className="headline text-2xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </div>
  );
}
