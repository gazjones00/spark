import type * as React from "react";

import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { SparkMark } from "@/components/spark-mark";
import { cn } from "@/lib/utils";

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

/*
 * The landing page is art-directed with fixed colors (dark hero / light
 * middle) rather than theme tokens, so it reads identically in light and
 * dark mode — like a printed spec sheet. Only the app respects the theme.
 */

const INK = "#18191b";
const PAPER = "#eff0f1";

function LandingPage() {
  return (
    <div className="flex min-h-svh flex-col overflow-x-clip bg-[#0c0c0c] text-[#eff0f1]">
      <Header />
      <main className="flex-1">
        <Hero />
        <PrinciplesBand />
        <Features />
        <Security />
        <ClosingCta />
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#2f3032] bg-[#0c0c0c]/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <SparkMark className="size-6" />
          <span className="font-display text-lg font-semibold tracking-[0.12em]">SPARK</span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="#features"
            className="font-mono text-[11px] font-medium tracking-[0.14em] text-[#a3a3a4] transition-colors hover:text-[#eff0f1]"
          >
            FEATURES
          </a>
          <a
            href="#security"
            className="font-mono text-[11px] font-medium tracking-[0.14em] text-[#a3a3a4] transition-colors hover:text-[#eff0f1]"
          >
            SECURITY
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "text-[#c3c4c8] hover:bg-[#222326] hover:text-[#eff0f1]",
            )}
          >
            Sign in
          </Link>
          <Link to="/signup" className={cn(buttonVariants({ size: "sm" }), "px-4")}>
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto w-full max-w-6xl px-4 pt-20 pb-14 sm:px-6 sm:pt-28">
        <p className="eyebrow text-[#a3a3a4]">Personal finance, instrumented</p>
        <h1 className="headline mt-6 text-4xl sm:text-7xl lg:text-[5.5rem]">
          Every account.
          <br />
          One ledger.
        </h1>
        <p className="mt-7 max-w-xl text-base leading-relaxed text-[#a3a3a4] sm:text-lg">
          Spark connects to your banks through Open Banking and turns balances, income, and spending
          into a single live view. No spreadsheets. No screen-scraping. No noise.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            to="/signup"
            className={cn(buttonVariants({ size: "lg" }), "h-11 gap-2 px-6 text-sm")}
          >
            Start tracking free
            <ArrowRight className="size-4" />
          </Link>
          <Link
            to="/login"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "h-11 border-[#464749] bg-transparent px-6 text-sm text-[#eff0f1] hover:bg-[#eff0f1]/10 hover:text-[#eff0f1] dark:border-[#464749] dark:bg-transparent dark:hover:bg-[#eff0f1]/10",
            )}
          >
            Sign in
          </Link>
        </div>
      </div>

      <HeroSparkline />
    </section>
  );
}

/** The signature: a live-reading balance sparkline drawn on page load. */
function HeroSparkline() {
  const line =
    "M0 232 L60 232 L80 238 L130 224 L160 228 L210 204 L240 210 L290 196 L330 168 L360 178 L420 172 L450 148 L500 156 L540 128 L580 136 L640 118 L680 124 L730 96 L770 104 L830 88 L870 72 L920 80 L970 58 L1020 66 L1080 44 L1130 50 L1160 38";
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
      <div
        className="bg-dotgrid relative rounded-sm border border-[#2f3032] bg-[#111112]"
        style={{ "--dotgrid-color": "#222326" } as React.CSSProperties}
      >
        <div className="absolute top-4 left-4 sm:top-6 sm:left-6">
          <p className="font-mono text-[10px] font-medium tracking-[0.14em] text-[#747576]">
            NET WORTH
          </p>
          <p className="font-display mt-1 text-3xl font-semibold tabular-nums sm:text-4xl">
            £24,318
          </p>
          <p className="mt-1 font-mono text-[11px] font-medium tracking-wide text-[#7bfe2a]">
            ▲ +£412 THIS MONTH
          </p>
        </div>
        <p className="absolute bottom-3 left-4 font-mono text-[10px] tracking-[0.14em] text-[#464749] sm:left-6">
          — SAMPLE DATA
        </p>
        <svg
          viewBox="0 0 1200 300"
          preserveAspectRatio="none"
          className="h-56 w-full sm:h-72"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fe5b2a" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#fe5b2a" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={`${line} L1160 300 L0 300 Z`}
            fill="url(#spark-fill)"
            className="animate-spark-fade"
          />
          <path
            d={line}
            fill="none"
            stroke="#fe5b2a"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            className="animate-spark-draw"
          />
          <circle cx="1160" cy="38" r="5" fill="#fe5b2a" className="animate-spark-fade" />
          <circle
            cx="1160"
            cy="38"
            r="10"
            fill="none"
            stroke="#fe5b2a"
            strokeWidth="1.5"
            className="animate-spark-pulse"
          />
        </svg>
      </div>
    </div>
  );
}

const PRINCIPLES = [
  {
    title: "Read-only",
    body: "Connections go through your bank's own login. Spark can look — it can never move money.",
  },
  {
    title: "Automatic",
    body: "Balances and transactions keep themselves current. Reconnect flows catch expired consents.",
  },
  {
    title: "To the penny",
    body: "Signed amounts, running balances, every transaction accounted for and categorised.",
  },
] as const;

function PrinciplesBand() {
  return (
    <section className="border-t border-[#2f3032] bg-[#141415]">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 divide-y divide-[#2f3032] px-4 sm:px-6 md:grid-cols-3 md:divide-x md:divide-y-0">
        {PRINCIPLES.map((p) => (
          <div key={p.title} className="py-10 pr-8 md:px-8 md:first:pl-0 md:last:pr-0">
            <h3 className="headline text-2xl sm:text-3xl">{p.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-[#a3a3a4]">{p.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const FEATURE_BLOCKS = [
  {
    name: "Connect",
    lede: "Link your banks in minutes.",
    body: "Authentication happens at your bank through TrueLayer's Open Banking rails — your credentials never touch Spark.",
    rows: [
      "Read-only Open Banking connection",
      "Current, savings & credit card accounts",
      "Guided reconnect when a consent expires",
    ],
  },
  {
    name: "Track",
    lede: "Every transaction, categorised.",
    body: "Purchases, transfers, direct debits, fees — each one lands in your ledger with a category, a merchant, and an exact signed amount.",
    rows: [
      "Automatic categorisation",
      "Search & filter by account, category, or date",
      "Amounts signed and exact — to the penny",
    ],
  },
  {
    name: "Measure",
    lede: "Watch the trend, not the noise.",
    body: "Net worth over time, income against spending, and category breakdowns turn raw statements into readings you can act on.",
    rows: [
      "Balance history across all accounts",
      "Income vs spending, month by month",
      "Category breakdowns that show where it goes",
    ],
  },
] as const;

function Features() {
  return (
    <section id="features" className="scroll-mt-16" style={{ backgroundColor: PAPER, color: INK }}>
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <p className="eyebrow text-[#6b6c6e]">What Spark does</p>
        <h2 className="headline mt-5 max-w-3xl text-4xl sm:text-5xl">
          From raw transactions to a clear picture.
        </h2>

        <div className="mt-16 space-y-16 sm:mt-20 sm:space-y-20">
          {FEATURE_BLOCKS.map((block) => (
            <div
              key={block.name}
              className="grid gap-8 border-t border-[#c3c4c8] pt-10 md:grid-cols-[2fr_3fr] md:gap-16"
            >
              <h3 className="headline text-4xl sm:text-5xl">
                <span className="text-[#fe5b2a]">{"// "}</span>
                {block.name}
              </h3>
              <div>
                <p className="text-lg font-semibold">{block.lede}</p>
                <p className="mt-2 max-w-lg text-sm leading-relaxed text-[#6b6c6e]">{block.body}</p>
                <ul className="mt-6">
                  {block.rows.map((row) => (
                    <li
                      key={row}
                      className="flex items-baseline gap-3 border-t border-[#dcdee0] py-3 text-sm first:border-t-0"
                    >
                      <span className="font-mono text-xs font-medium text-[#fe5b2a]">→</span>
                      {row}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const SECURITY_POINTS = [
  "Sign-in happens on your bank's own pages — Spark never sees your banking credentials",
  "Access is scoped to reading balances and transactions, nothing more",
  "Revoke Spark's access at any time, straight from your bank",
] as const;

function Security() {
  return (
    <section id="security" className="scroll-mt-16 border-t border-[#2f3032] bg-[#141415]">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-20 sm:px-6 sm:py-28 md:grid-cols-[2fr_3fr] md:gap-16">
        <div>
          <p className="eyebrow text-[#a3a3a4]">Security</p>
          <h2 className="headline mt-5 text-4xl sm:text-5xl">
            Read-only
            <br />
            by design.
          </h2>
        </div>
        <div>
          <p className="max-w-lg text-sm leading-relaxed text-[#a3a3a4]">
            Spark is built on Open Banking — the regulated framework UK banks use to share data with
            your consent. The connection is structurally incapable of touching your money.
          </p>
          <ul className="mt-8">
            {SECURITY_POINTS.map((point) => (
              <li
                key={point}
                className="flex items-baseline gap-3 border-t border-[#2f3032] py-4 text-sm text-[#eff0f1]"
              >
                <span className="font-mono text-xs font-medium text-[#fe5b2a]">→</span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function ClosingCta() {
  return (
    <section
      className="bg-dotgrid border-t border-[#2f3032]"
      style={{ "--dotgrid-color": "#222326" } as React.CSSProperties}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-8 px-4 py-24 sm:px-6 sm:py-32">
        <p className="eyebrow text-[#a3a3a4]">Get started</p>
        <h2 className="headline max-w-3xl text-4xl sm:text-6xl">Run the numbers on your money.</h2>
        <Link
          to="/signup"
          className={cn(buttonVariants({ size: "lg" }), "h-11 gap-2 px-6 text-sm")}
        >
          Create your account
          <ArrowUpRight className="size-4" />
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ backgroundColor: PAPER, color: INK }}>
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2.5">
            <SparkMark className="size-5" />
            <span className="font-display text-base font-semibold tracking-[0.12em]">SPARK</span>
          </div>
          <p className="mt-3 max-w-xs text-xs leading-relaxed text-[#6b6c6e]">
            Personal finance, instrumented. Every account, one ledger.
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] font-medium tracking-[0.14em] text-[#6b6c6e]">
            PAGES
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <a href="#features" className="transition-colors hover:text-[#fe5b2a]">
                Features
              </a>
            </li>
            <li>
              <a href="#security" className="transition-colors hover:text-[#fe5b2a]">
                Security
              </a>
            </li>
          </ul>
        </div>
        <div>
          <p className="font-mono text-[10px] font-medium tracking-[0.14em] text-[#6b6c6e]">
            ACCOUNT
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link to="/login" className="transition-colors hover:text-[#fe5b2a]">
                Sign in
              </Link>
            </li>
            <li>
              <Link to="/signup" className="transition-colors hover:text-[#fe5b2a]">
                Create account
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[#dcdee0]">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 sm:px-6">
          <p className="font-mono text-[10px] tracking-[0.14em] text-[#6b6c6e]">© 2026 SPARK</p>
          <p className="font-mono text-[10px] tracking-[0.14em] text-[#6b6c6e]">
            BUILT ON OPEN BANKING
          </p>
        </div>
      </div>
    </footer>
  );
}
