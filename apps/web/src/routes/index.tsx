import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  KeyRound,
  Landmark,
  Lock,
  PieChart,
  RefreshCw,
  ShieldCheck,
  Tags,
  Unplug,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { SparkLogo, SparkMark } from "@/components/spark-mark";
import { ProductPreview } from "@/features/marketing/components/ProductPreview";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/server/auth";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    // Signed-in visitors go straight to their Home. The landing page must
    // still render if the session check itself fails.
    const user = await getCurrentUser().catch(() => null);
    if (user) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="bg-background text-foreground relative flex min-h-svh flex-col overflow-x-clip">
      <div
        aria-hidden="true"
        className="bg-spark-glow pointer-events-none absolute inset-x-0 top-0 h-[52rem]"
      />
      <Header />
      <main className="relative flex-1">
        <Hero />
        <Features />
        <HowItWorks />
        <Security />
        <ClosingCta />
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="bg-background/70 border-border/60 sticky top-0 z-50 border-b backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" aria-label="Spark home">
          <SparkLogo />
        </Link>
        <nav aria-label="Sections" className="hidden items-center gap-8 text-sm md:flex">
          <a href="#features" className="text-muted-foreground hover:text-foreground">
            Features
          </a>
          <a href="#how-it-works" className="text-muted-foreground hover:text-foreground">
            How it works
          </a>
          <a href="#security" className="text-muted-foreground hover:text-foreground">
            Security
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/login" className={buttonVariants({ variant: "ghost" })}>
            Sign in
          </Link>
          <Link to="/signup" className={buttonVariants()}>
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}

const HERO_POINTS = ["Free to use", "Read-only access", "Disconnect anytime"] as const;

function Hero() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-14 sm:px-6 sm:pt-20">
      <div className="mx-auto max-w-3xl text-center">
        <span className="bg-card/80 border-border shadow-card inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
          <ShieldCheck className="text-success size-3.5" />
          Open Banking for UK banks and cards
        </span>
        <h1 className="headline mt-6 text-[2.75rem] sm:text-6xl lg:text-7xl">
          Your money,
          <br />
          <span className="text-spark-gradient">all in one place.</span>
        </h1>
        <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-base leading-relaxed sm:text-lg">
          Spark brings your current accounts, savings and credit cards together, sorts every
          transaction for you, and shows you exactly where your money goes.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            to="/signup"
            className={cn(buttonVariants({ size: "lg" }), "h-11 px-6 text-[0.9375rem]")}
          >
            Get started free
            <ArrowRight />
          </Link>
          <Link
            to="/login"
            className={cn(
              buttonVariants({ size: "lg", variant: "outline" }),
              "h-11 px-6 text-[0.9375rem]",
            )}
          >
            Sign in
          </Link>
        </div>
        <ul className="text-muted-foreground mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
          {HERO_POINTS.map((point) => (
            <li key={point} className="inline-flex items-center gap-1.5">
              <Check className="text-success size-4" />
              {point}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative mx-auto mt-14 max-w-5xl sm:mt-16">
        <ProductPreview />
        <p className="text-muted-foreground mt-3 text-center text-xs">Sample data</p>
      </div>
    </section>
  );
}

const FEATURES = [
  {
    icon: Landmark,
    title: "Every account together",
    body: "Current accounts, savings and credit cards side by side, with a net worth that counts what you owe on cards.",
  },
  {
    icon: Tags,
    title: "Transactions sorted for you",
    body: "Every payment gets a category and a clean merchant name. Teach Spark once with a rule and it remembers.",
  },
  {
    icon: PieChart,
    title: "See where it goes",
    body: "Spending by category, this month against last, and how your net worth is trending over time.",
  },
  {
    icon: RefreshCw,
    title: "Always up to date",
    body: "Spark syncs in the background and lets you know before your bank access needs renewing.",
  },
] as const;

function Features() {
  return (
    <section id="features" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
      <SectionHeading
        eyebrow="Why Spark"
        title="Everything you need to understand your money."
        body="No spreadsheets and no copying numbers between apps. Connect once and Spark keeps the picture current."
      />
      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="bg-card border-border shadow-card rounded-2xl border p-6 sm:p-7"
          >
            <span className="bg-accent text-accent-foreground inline-flex size-10 items-center justify-center rounded-xl">
              <feature.icon className="size-5" />
            </span>
            <h3 className="mt-5 text-lg font-bold">{feature.title}</h3>
            <p className="text-muted-foreground mt-2 text-[0.9375rem] leading-relaxed">
              {feature.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

const STEPS = [
  {
    title: "Connect your bank",
    body: "Choose your bank and approve read-only access in its own app. It takes about a minute.",
  },
  {
    title: "Pick your accounts",
    body: "Add the accounts you want. Balances appear straight away and your history follows.",
  },
  {
    title: "See the full picture",
    body: "Home shows your net worth, this month so far and where your money goes.",
  },
] as const;

function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-card border-border scroll-mt-16 border-y">
      <div className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6">
        <SectionHeading eyebrow="How it works" title="Up and running in three steps." />
        <ol className="mt-12 grid gap-8 md:grid-cols-3 md:gap-10">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <span className="bg-spark-gradient inline-flex size-9 items-center justify-center rounded-full text-sm font-bold text-white">
                {index + 1}
              </span>
              <h3 className="mt-4 text-lg font-bold">{step.title}</h3>
              <p className="text-muted-foreground mt-2 text-[0.9375rem] leading-relaxed">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const SECURITY_POINTS = [
  {
    icon: KeyRound,
    title: "You log in at your bank",
    body: "Spark never sees or stores your banking password.",
  },
  {
    icon: Lock,
    title: "It can't move money",
    body: "Access is limited to reading balances and transactions.",
  },
  {
    icon: ShieldCheck,
    title: "A regulated connection",
    body: "Connections run through TrueLayer, a regulated Open Banking provider.",
  },
  {
    icon: Unplug,
    title: "You stay in control",
    body: "Remove an account in Spark, or revoke access from your bank, at any time.",
  },
] as const;

function Security() {
  return (
    <section id="security" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
      <div className="grid gap-12 md:grid-cols-[2fr_3fr] md:gap-16">
        <SectionHeading
          align="left"
          eyebrow="Security"
          title="Read-only, by design."
          body="Spark is built on Open Banking, the regulated way UK banks share your data with your consent."
        />
        <ul className="grid gap-x-8 gap-y-8 sm:grid-cols-2">
          {SECURITY_POINTS.map((point) => (
            <li key={point.title} className="flex gap-4">
              <span className="bg-success/12 text-success inline-flex size-10 shrink-0 items-center justify-center rounded-xl">
                <point.icon className="size-5" />
              </span>
              <span>
                <span className="text-foreground block font-semibold">{point.title}</span>
                <span className="text-muted-foreground mt-1 block text-[0.9375rem] leading-relaxed">
                  {point.body}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ClosingCta() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
      <div className="bg-spark-gradient relative overflow-hidden rounded-3xl px-6 py-16 text-center text-white sm:px-12 sm:py-20">
        <SparkMark
          mono
          className="pointer-events-none absolute -top-10 -right-10 size-64 text-white/10 sm:size-80"
        />
        <SparkMark
          mono
          className="pointer-events-none absolute -bottom-16 -left-12 size-48 text-white/10"
        />
        <h2 className="headline relative mx-auto max-w-2xl text-3xl text-white sm:text-5xl">
          Get a clearer picture of your money.
        </h2>
        <p className="relative mx-auto mt-4 max-w-md text-base text-white/85">
          Free to start. Connect your first account in about a minute.
        </p>
        <Link
          to="/signup"
          className={cn(
            buttonVariants({ size: "lg" }),
            "relative mt-8 h-11 bg-white px-6 text-[0.9375rem] text-[#2a1b5c] shadow-lg hover:bg-white/90",
          )}
        >
          Create your account
          <ArrowRight />
        </Link>
      </div>
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  body,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  body?: string;
  align?: "center" | "left";
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center")}>
      <p className="text-primary text-sm font-semibold">{eyebrow}</p>
      <h2 className="headline mt-3 text-3xl sm:text-[2.75rem]">{title}</h2>
      {body ? (
        <p className="text-muted-foreground mt-4 text-base leading-relaxed sm:text-lg">{body}</p>
      ) : null}
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-border border-t">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div>
          <SparkLogo />
          <p className="text-muted-foreground mt-3 max-w-xs text-sm">
            All your money, in one place. Built on Open Banking.
          </p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-16 gap-y-2 text-sm">
          <a href="#features" className="text-muted-foreground hover:text-foreground">
            Features
          </a>
          <Link to="/login" className="text-muted-foreground hover:text-foreground">
            Sign in
          </Link>
          <a href="#security" className="text-muted-foreground hover:text-foreground">
            Security
          </a>
          <Link to="/signup" className="text-muted-foreground hover:text-foreground">
            Create account
          </Link>
        </nav>
      </div>
      <div className="border-border border-t">
        <p className="text-muted-foreground mx-auto w-full max-w-6xl px-4 py-5 text-xs sm:px-6">
          © 2026 Spark
        </p>
      </div>
    </footer>
  );
}
