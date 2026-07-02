import { AlertTriangle, RotateCcw } from "lucide-react";
import { useRouter, type ErrorComponentProps } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Route-level error boundary body: rendered when a route's loader or render
 * throws, instead of letting the error bubble to an unhandled crash.
 * `router.invalidate()` re-runs the failed loaders and re-renders the route.
 */
export function RouteError({ error }: ErrorComponentProps) {
  const router = useRouter();

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <Card className="max-w-md">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <AlertTriangle className="text-destructive size-8" aria-hidden />
          <div>
            <h2 className="text-lg font-semibold">Something went wrong</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {error instanceof Error ? error.message : "An unexpected error occurred."}
            </p>
          </div>
          <Button variant="outline" onClick={() => void router.invalidate()}>
            <RotateCcw className="size-4" aria-hidden />
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
