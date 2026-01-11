import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowRight, TrendingUp, Shield, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    // Redirect to dashboard if already authenticated
    // Only check on client side
    if (typeof window !== "undefined") {
      const user = localStorage.getItem("spark-user");
      if (user) {
        throw redirect({ to: "/dashboard" });
      }
    }
  },
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="container mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <span className="text-lg font-bold">Spark</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm">
              <Link to="/login">Sign in</Link>
            </Button>
            <Button size="sm">
              <Link to="/signup">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="container mx-auto max-w-6xl px-4 py-20 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Take control of your
            <br />
            <span className="text-primary">personal finances</span>
          </h1>
          <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg">
            Connect your bank accounts, track spending, and gain insights into your financial
            health. All in one simple, secure app.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Button size="lg">
              <Link to="/signup">
                Get Started Free
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Button variant="outline" size="lg">
              <Link to="/login">Sign In</Link>
            </Button>
          </div>
        </section>

        <section className="border-t bg-muted/30 py-20">
          <div className="container mx-auto max-w-6xl px-4">
            <h2 className="mb-12 text-center text-2xl font-bold">
              Everything you need to manage your money
            </h2>
            <div className="grid gap-6 md:grid-cols-3">
              <Card>
                <CardContent className="p-6">
                  <div className="bg-primary/10 mb-4 inline-flex rounded-none p-3">
                    <TrendingUp className="text-primary size-6" />
                  </div>
                  <h3 className="mb-2 font-semibold">Track Spending</h3>
                  <p className="text-muted-foreground text-sm">
                    See where your money goes with automatic categorization and detailed transaction
                    history.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="bg-primary/10 mb-4 inline-flex rounded-none p-3">
                    <Shield className="text-primary size-6" />
                  </div>
                  <h3 className="mb-2 font-semibold">Bank-Level Security</h3>
                  <p className="text-muted-foreground text-sm">
                    Your data is encrypted and protected with the same security standards used by
                    major banks.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="bg-primary/10 mb-4 inline-flex rounded-none p-3">
                    <Zap className="text-primary size-6" />
                  </div>
                  <h3 className="mb-2 font-semibold">Real-Time Sync</h3>
                  <p className="text-muted-foreground text-sm">
                    Connect multiple accounts and see all your finances in one place, updated
                    automatically.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-6">
        <div className="container mx-auto max-w-6xl px-4 text-center">
          <p className="text-muted-foreground text-sm">
            &copy; 2025 Spark. Personal Finance Made Simple.
          </p>
        </div>
      </footer>
    </div>
  );
}
