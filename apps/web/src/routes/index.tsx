import type { ReactNode } from "react";

import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowRight, TrendingUp } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { SparkLogo, SparkMark } from "@/components/spark-mark";
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

/*
 * Editorial layout: a deep-ink brand band (headline, sample chart, the three
 * promises), the product story on the page background, security, and a
 * closing band that bookends the hero. The ink bands are art-directed and look
 * the same in light and dark mode, like the sign-in brand panel; everything
 * else follows the theme.
 */

function LandingPage() {
  return (
    <div className="bg-background text-foreground flex min-h-svh flex-col overflow-x-clip">
      <Header />
      <main className="flex-1">
        <Hero />
        <Features />
        <Security />
        <ClosingCta />
      </main>
      <Footer />
    </div>
  );
}

const INK_PRIMARY = "bg-white text-ink shadow-none hover:bg-white/90";
const INK_OUTLINE =
  "border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white dark:border-white/20 dark:bg-transparent dark:hover:bg-white/10";

function Header() {
  return (
    <header className="bg-ink/90 sticky top-0 z-50 border-b border-white/10 text-white backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" aria-label="Spark home">
          <SparkLogo className="[&>span:last-child]:text-white" />
        </Link>
        <nav aria-label="Sections" className="hidden items-center gap-8 text-sm md:flex">
          <a href="#features" className="text-white/70 transition-colors hover:text-white">
            Features
          </a>
          <a href="#security" className="text-white/70 transition-colors hover:text-white">
            Security
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "text-white/80 hover:bg-white/10 hover:text-white dark:hover:bg-white/10",
            )}
          >
            Sign in
          </Link>
          <Link to="/signup" className={cn(buttonVariants(), INK_PRIMARY)}>
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="bg-ink text-white">
      <div className="mx-auto w-full max-w-6xl px-4 pt-16 sm:px-6 sm:pt-24">
        <div className="grid gap-8 lg:grid-cols-[1.7fr_1fr] lg:items-end lg:gap-14">
          <div>
            <p className="eyebrow text-white/60">Personal finance for UK bank accounts and cards</p>
            <h1 className="headline mt-5 text-[2.75rem] tracking-[-0.035em] sm:text-7xl lg:text-[4.5rem]">
              Every account.
              <br />
              One clear picture.
            </h1>
          </div>
          <div className="lg:pb-2">
            <p className="text-base leading-relaxed text-white/70 sm:text-lg">
              Spark connects to your current accounts, savings and credit cards through Open
              Banking, sorts every transaction, and shows what you're worth and where your money
              goes.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/signup"
                className={cn(buttonVariants({ size: "lg" }), INK_PRIMARY, "h-11 px-6")}
              >
                Get started free
                <ArrowRight />
              </Link>
              <Link
                to="/login"
                className={cn(
                  buttonVariants({ size: "lg", variant: "outline" }),
                  INK_OUTLINE,
                  "h-11 px-6",
                )}
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>

        <SampleNetWorth />
        <Promises />
      </div>
    </section>
  );
}

// A year of weekly net worth, saving steadily with a payday rhythm, on a
// 1200×300 canvas. It stops short of the right edge to leave room for the dot.
const LINE =
  "M0 243 L22 241 L45 245 L67 250 L89 244 L112 223 L134 224 L156 227 L178 230 L201 206 L223 209 L245 206 L268 215 L290 215 L312 187 L335 187 L357 194 L379 199 L402 172 L424 169 L446 173 L468 176 L491 151 L513 156 L535 158 L558 155 L580 166 L602 138 L625 136 L647 137 L669 147 L692 118 L714 115 L736 121 L758 128 L781 97 L803 96 L825 105 L848 101 L870 113 L892 80 L915 81 L937 82 L959 92 L982 67 L1004 63 L1026 64 L1048 69 L1071 40 L1093 45 L1115 51 L1138 55 L1160 54";

const SAMPLE_ACCOUNTS = [
  { name: "Current account", amount: "£2,140.22", dot: "#ff9a3c" },
  { name: "Savings", amount: "£23,000.00", dot: "#ff5470" },
  { name: "Credit card", amount: "−£821.82", dot: "#8a5cff" },
] as const;

/** The signature: Home's net worth reading, drawn in the brand gradient. */
function SampleNetWorth() {
  return (
    <figure className="mt-14 sm:mt-20">
      <div
        role="img"
        aria-label="Sample net worth of £24,318.40, up £4,698.40 over the past year, made up of a current account, savings and a credit card balance that counts as money owed"
        className="bg-dotgrid overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] [--dotgrid-color:rgb(255_255_255/0.06)]"
      >
        <div className="flex flex-wrap items-start justify-between gap-6 p-5 sm:p-8">
          <div>
            <p className="text-sm font-medium text-white/60">Net worth</p>
            <p className="figure mt-1 text-4xl font-bold sm:text-5xl">£24,318.40</p>
            <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#3dd68c]/15 px-2 py-0.5 font-semibold text-[#3dd68c]">
                <TrendingUp className="size-3.5" />
                +£4,698.40 (+23.9%)
              </span>
              <span className="text-white/50">past year</span>
            </p>
          </div>
          <dl className="hidden min-w-64 text-sm md:block">
            {SAMPLE_ACCOUNTS.map((account) => (
              <div
                key={account.name}
                className="flex items-center justify-between gap-8 border-b border-white/10 py-2 last:border-b-0"
              >
                <dt className="flex items-center gap-2 text-white/60">
                  <span className="size-2 rounded-full" style={{ backgroundColor: account.dot }} />
                  {account.name}
                </dt>
                <dd className="figure font-semibold">{account.amount}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative h-44 sm:h-64">
          <svg
            viewBox="0 0 1200 300"
            preserveAspectRatio="none"
            className="absolute inset-0 size-full"
            aria-hidden="true"
          >
            <defs>
              <linearGradient
                id="landing-line"
                x1="0"
                y1="0"
                x2="1200"
                y2="0"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0" stopColor="#ff9a3c" />
                <stop offset="0.5" stopColor="#ff5470" />
                <stop offset="1" stopColor="#8a5cff" />
              </linearGradient>
              <linearGradient id="landing-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#8a5cff" stopOpacity="0.3" />
                <stop offset="1" stopColor="#8a5cff" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d={`${LINE} L1160 300 L0 300 Z`}
              fill="url(#landing-fill)"
              className="animate-spark-fade"
            />
            <path
              d={LINE}
              fill="none"
              stroke="url(#landing-line)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              className="animate-spark-draw"
            />
          </svg>
          {/* Positioned in HTML so it stays round however the chart stretches. */}
          <span className="absolute top-[18%] left-[96.67%] -translate-x-1/2 -translate-y-1/2">
            <span className="animate-spark-pulse absolute -inset-1.5 rounded-full border border-[#8a5cff]" />
            <span className="animate-spark-fade block size-2.5 rounded-full bg-[#8a5cff]" />
          </span>
        </div>

        <div className="flex justify-between border-t border-white/10 px-5 py-3 text-xs text-white/55 sm:px-8">
          <span>Nov 2025</span>
          <span className="hidden sm:inline">Low £19.4k · High £24.7k</span>
          <span>Today</span>
        </div>
      </div>
      <figcaption className="mt-3 text-right text-xs text-white/55">Sample data</figcaption>
    </figure>
  );
}

const PROMISES = [
  {
    title: "Read-only",
    body: "You approve access at your bank. Spark can see your balances and transactions, and can never move money.",
  },
  {
    title: "Automatic",
    body: "Balances and transactions keep themselves up to date, and Spark tells you before bank access needs renewing.",
  },
  {
    title: "To the penny",
    body: "Card balances count as money you owe, and moving money between your own accounts isn't counted as spending.",
  },
] as const;

function Promises() {
  return (
    <div className="mt-16 grid divide-y divide-white/10 border-t border-white/10 md:grid-cols-3 md:divide-x md:divide-y-0">
      {PROMISES.map((promise) => (
        <div key={promise.title} className="py-10 md:px-8 md:first:pl-0 md:last:pr-0">
          <h2 className="headline text-2xl sm:text-3xl">{promise.title}</h2>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-white/65">{promise.body}</p>
        </div>
      ))}
    </div>
  );
}

const FEATURE_BLOCKS = [
  {
    name: "Connect",
    lede: "Link your banks in about a minute.",
    body: "Pick your bank and approve access in its own app. Spark connects through TrueLayer's regulated Open Banking service, so your banking password never touches Spark.",
    rows: [
      "Current accounts, savings and credit cards",
      "Reconnect in a couple of taps, with your history kept",
      "A heads-up before bank access needs renewing",
    ],
  },
  {
    name: "Track",
    lede: "Every transaction, sorted for you.",
    body: "Payments arrive with a category and a clean merchant name. Fix one and turn it into a rule, and Spark gets it right from then on.",
    rows: [
      "Automatic categories, plus your own",
      "Rules for the merchants you see every month",
      "Search and filter by account, category or date",
    ],
  },
  {
    name: "Understand",
    lede: "See where your money goes.",
    body: "Home shows what you're worth, how this month is going and your biggest spending categories, without a spreadsheet in sight.",
    rows: [
      "Net worth over time, across every account",
      "Money in and out, month by month",
      "Spending by category, this month against last",
    ],
  },
] as const;

function Features() {
  return (
    <section id="features" className="scroll-mt-16">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <p className="eyebrow">What Spark does</p>
        <h2 className="headline mt-4 max-w-3xl text-4xl sm:text-5xl">
          From raw transactions to a clear picture.
        </h2>

        <div className="mt-14 space-y-14 sm:mt-20 sm:space-y-20">
          {FEATURE_BLOCKS.map((block) => (
            <div
              key={block.name}
              className="border-border grid gap-6 border-t pt-10 md:grid-cols-[2fr_3fr] md:gap-16"
            >
              <h3 className="headline text-4xl sm:text-5xl">{block.name}</h3>
              <div>
                <p className="text-lg font-semibold">{block.lede}</p>
                <p className="text-muted-foreground mt-2 max-w-lg text-[0.9375rem] leading-relaxed">
                  {block.body}
                </p>
                <RuledList items={block.rows} className="mt-6" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const SECURITY_POINTS = [
  "You sign in on your bank's own pages, so Spark never sees your banking password",
  "Access is limited to reading balances and transactions; Spark can't move money",
  "Connections run through TrueLayer, a regulated Open Banking provider",
  "Remove an account in Spark, or revoke access from your bank, at any time",
] as const;

function Security() {
  return (
    <section id="security" className="bg-card border-border scroll-mt-16 border-y">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-20 sm:px-6 sm:py-28 md:grid-cols-[2fr_3fr] md:gap-16">
        <div>
          <p className="eyebrow">Security</p>
          <h2 className="headline mt-4 text-4xl sm:text-5xl">
            Read-only,
            <br />
            by design.
          </h2>
        </div>
        <div>
          <p className="text-muted-foreground max-w-lg text-[0.9375rem] leading-relaxed">
            Spark is built on Open Banking, the regulated way UK banks share your data with your
            consent. The connection can read your accounts, and nothing else.
          </p>
          <RuledList items={SECURITY_POINTS} className="mt-8" />
        </div>
      </div>
    </section>
  );
}

function RuledList({ items, className }: { items: readonly string[]; className?: string }) {
  return (
    <ul className={className}>
      {items.map((item) => (
        <li
          key={item}
          className="border-border flex items-start gap-3 border-t py-3.5 text-[0.9375rem] first:border-t-0"
        >
          <ArrowRight className="text-primary mt-0.5 size-4 shrink-0" />
          {item}
        </li>
      ))}
    </ul>
  );
}

function ClosingCta() {
  return (
    <section className="bg-ink relative overflow-hidden text-white">
      <SparkMark
        mono
        className="pointer-events-none absolute -right-20 -bottom-24 size-[22rem] text-white/[0.06] sm:size-[28rem]"
      />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col items-start px-4 py-24 sm:px-6 sm:py-32">
        <p className="eyebrow text-white/60">Get started</p>
        <h2 className="headline mt-4 max-w-3xl text-4xl sm:text-6xl">
          See where your money is today.
        </h2>
        <p className="mt-5 max-w-md text-base text-white/70 sm:text-lg">
          Free to use. Connect your first bank in about a minute.
        </p>
        <Link
          to="/signup"
          className={cn(buttonVariants({ size: "lg" }), INK_PRIMARY, "mt-9 h-11 px-6")}
        >
          Create your account
          <ArrowRight />
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer>
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[2fr_1fr_1fr]">
        <div>
          <SparkLogo />
          <p className="text-muted-foreground mt-3 max-w-xs text-sm leading-relaxed">
            Every account, one clear picture. Personal finance for UK bank accounts and cards.
          </p>
        </div>
        <FooterLinks title="Product">
          <a href="#features" className="text-muted-foreground hover:text-foreground">
            Features
          </a>
          <a href="#security" className="text-muted-foreground hover:text-foreground">
            Security
          </a>
        </FooterLinks>
        <FooterLinks title="Account">
          <Link to="/login" className="text-muted-foreground hover:text-foreground">
            Sign in
          </Link>
          <Link to="/signup" className="text-muted-foreground hover:text-foreground">
            Create account
          </Link>
        </FooterLinks>
      </div>
      <div className="border-border border-t">
        <div className="text-muted-foreground mx-auto flex w-full max-w-6xl flex-wrap justify-between gap-2 px-4 py-5 text-xs sm:px-6">
          <p>© 2026 Spark</p>
          <p>Built on Open Banking</p>
        </div>
      </div>
    </footer>
  );
}

function FooterLinks({ title, children }: { title: string; children: ReactNode }) {
  return (
    <nav aria-label={title}>
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-3 flex flex-col items-start gap-2 text-sm">{children}</div>
    </nav>
  );
}
