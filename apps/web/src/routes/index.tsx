import type { ReactNode } from "react";

import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { SparkLines } from "@/components/spark-lines";
import { SparkLogo } from "@/components/spark-mark";
import { ProductStory } from "@/features/marketing/components/ProductStory";
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
 * Art-directed in either theme (the `.landing` scope pins light tokens): a
 * white hero with the signature line art, an ink statement band, the
 * product story beside a sticky illustration panel, facts, a security band
 * and a pale footer.
 */

function LandingPage() {
  return (
    <div className="landing flex min-h-svh flex-col overflow-x-clip bg-white text-[#0b0b0f]">
      <Header />
      <main className="flex-1">
        <Hero />
        <Statement />
        <Story />
        <Facts />
        <SecurityBand />
      </main>
      <Footer />
    </div>
  );
}

/** Content column: backgrounds (and the product story) run full width. */
const CONTAINER = "mx-auto w-full max-w-7xl px-4 sm:px-6";

const INK_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-[#0b0b0f] font-medium text-white transition-colors hover:bg-[#2a2a2f] focus-visible:ring-[3px] focus-visible:ring-[#c98200]/50 outline-none";

function Header() {
  return (
    <header className="sticky top-0 z-50 h-16 border-b border-[#e3e3eb] bg-white/85 backdrop-blur-md">
      <div className={cn(CONTAINER, "flex h-full items-center gap-10")}>
        <Link to="/" aria-label="Spark home">
          <SparkLogo />
        </Link>
        <nav aria-label="Sections" className="hidden items-center gap-7 text-[0.9375rem] md:flex">
          <a href="#features" className="hover:text-[#5f5f6e]">
            Features
          </a>
          <a href="#security" className="hover:text-[#5f5f6e]">
            Security
          </a>
        </nav>
        <div className="ml-auto flex items-center gap-5">
          <Link to="/login" className="text-[0.9375rem] hover:text-[#5f5f6e]">
            Sign in
          </Link>
          <Link to="/signup" className={cn(INK_BUTTON, "h-10 px-4 text-[0.9375rem]")}>
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
      <SparkLines
        animate
        className="absolute inset-x-0 top-0 h-80 w-full [mask-image:linear-gradient(black_55%,transparent)] sm:h-[26rem] lg:hidden [&_path]:stroke-[3.25] sm:[&_path]:stroke-[2.5]"
      />
      <div
        className={cn(CONTAINER, "relative flex flex-col justify-end lg:min-h-[calc(100svh-4rem)]")}
      >
        {/* A fixed size anchored to the column's right edge, so the bundle keeps
            clear of the headline at any width or height; the outer lines and
            the bundle run on to the edges of the hero. */}
        <SparkLines
          animate
          preserveAspectRatio="xMaxYMin meet"
          className="absolute top-0 right-0 hidden aspect-[1440/900] w-[80rem] overflow-visible lg:block"
        />
        <div className="relative pt-72 pb-14 sm:pt-96 lg:pt-[19rem] lg:pb-16">
          <h1 className="headline text-[clamp(3rem,7.4vw,6rem)] leading-[0.98]">
            Every account.
            <br />
            One clear picture.
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-relaxed sm:text-xl">
            Spark connects your current accounts, savings and credit cards through Open Banking,
            sorts every transaction, and shows what you're worth and where your money goes.
          </p>
          <div className="mt-10 flex flex-wrap items-end gap-x-6 gap-y-4">
            <Link to="/signup" className={cn(INK_BUTTON, "h-12 px-6 text-base")}>
              Create your free account
            </Link>
            <p className="pb-3 text-[0.9375rem] text-[#5f5f6e]">
              Already using Spark?{" "}
              <Link to="/login" className="text-[#0b0b0f] underline underline-offset-4">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

const SECTIONS = [
  {
    href: "#connect",
    title: "Connect",
    body: "Every UK bank account and card, in about a minute.",
  },
  { href: "#track", title: "Track", body: "Every payment categorised, with rules you control." },
  {
    href: "#understand",
    title: "Understand",
    body: "Net worth, this month, and where it all goes.",
  },
  {
    href: "#security",
    title: "Read-only",
    body: "Spark can see your money. It can never move it.",
  },
] as const;

function Statement() {
  return (
    <section className="bg-ink text-white">
      <div className={cn(CONTAINER, "py-20 sm:py-28")}>
        <p className="font-display mx-auto max-w-4xl text-center text-[1.75rem] leading-[1.15] font-medium tracking-[-0.025em] text-balance sm:text-[2.5rem] lg:text-[2.75rem]">
          Spark reads your accounts through regulated Open Banking, files every payment under the
          right category, and keeps one live picture of what you have, what you owe and where it
          goes.
        </p>
        <nav
          aria-label="What Spark does"
          className="mt-16 grid border-t border-white/15 sm:mt-20 sm:grid-cols-2 lg:grid-cols-4"
        >
          {SECTIONS.map((section) => (
            <a
              key={section.href}
              href={section.href}
              className="group border-b border-white/15 py-8 outline-none focus-visible:bg-white/[0.04] sm:px-6 sm:max-lg:odd:pl-0 lg:border-b-0 lg:border-l lg:px-6 lg:first:border-l-0 lg:first:pl-0"
            >
              <span className="font-display block text-[1.75rem] font-medium tracking-[-0.02em]">
                <span className="decoration-[#ffc24b] decoration-2 underline-offset-[6px] group-hover:underline">
                  {section.title}
                </span>
              </span>
              <span className="mt-2 block max-w-[16rem] text-[0.9375rem] leading-relaxed text-white/70">
                {section.body}
              </span>
            </a>
          ))}
        </nav>
      </div>
    </section>
  );
}

function Story() {
  return (
    <section id="features" className="scroll-mt-16">
      <div className={cn(CONTAINER, "pt-24 pb-14 sm:pt-32 sm:pb-20")}>
        <h2 className="headline max-w-3xl text-[2.75rem] sm:text-6xl">
          From raw transactions to a clear picture.
        </h2>
      </div>
      <ProductStory />
    </section>
  );
}

const FACTS = [
  { figure: "£0", label: "to use Spark" },
  { figure: "0", label: "banking passwords Spark ever sees" },
  { figure: "~1 min", label: "to connect a bank" },
  { figure: "3", label: "kinds of account: current, savings and cards" },
] as const;

function Facts() {
  return (
    <section className={CONTAINER}>
      <div className="pt-24 pb-24 sm:pt-32 sm:pb-28">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <div>
            <h2 className="headline max-w-3xl text-[2.75rem] sm:text-6xl">
              Your money, on your terms.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-relaxed">
              Free to use, and nothing to install. You approve access at your own bank, see
              everything in one place, and can revoke it whenever you like.
            </p>
          </div>
          <Link to="/signup" className={cn(INK_BUTTON, "h-12 px-6 text-base")}>
            Create your free account
          </Link>
        </div>
        <dl className="mt-14 grid grid-cols-2 border-t border-[#0b0b0f] lg:grid-cols-4">
          {FACTS.map((fact) => (
            <div
              key={fact.label}
              className="border-b border-[#e3e3eb] py-7 pr-6 lg:border-b-0 lg:border-l lg:pl-6 lg:first:border-l-0 lg:first:pl-0"
            >
              <dt className="sr-only">{fact.label}</dt>
              <dd>
                <span className="font-display block text-5xl font-medium tracking-[-0.035em] sm:text-6xl">
                  {fact.figure}
                </span>
                <span className="mt-3 block max-w-[14rem] text-[0.9375rem] text-[#5f5f6e]">
                  {fact.label}
                </span>
              </dd>
            </div>
          ))}
        </dl>
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

function SecurityBand() {
  return (
    <section id="security" className={cn(CONTAINER, "scroll-mt-16 pb-24 sm:pb-32")}>
      <div className="bg-ink grid gap-10 rounded-xl px-6 py-14 text-white sm:px-12 sm:py-20 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <div>
          <h2 className="headline text-[2.75rem] sm:text-6xl">Read-only, by design.</h2>
          <p className="mt-6 max-w-md text-[1.0625rem] leading-relaxed text-white/80">
            Spark is built on Open Banking, the regulated way UK banks share your data with your
            consent. The connection can read your accounts, and nothing else.
          </p>
        </div>
        <ul className="self-end">
          {SECURITY_POINTS.map((point) => (
            <li
              key={point}
              className="flex items-start gap-3 border-t border-white/15 py-4 text-[0.9375rem] text-white/90"
            >
              <ArrowRight className="mt-0.5 size-4 shrink-0 text-[#ffc24b]" />
              {point}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[#0b0b0f] bg-[#f5f5fa]">
      <div className={cn(CONTAINER, "grid gap-12 pt-16 pb-10 sm:pt-20 lg:grid-cols-[1.4fr_1fr]")}>
        <div>
          <SparkLogo className="[&>span:last-child]:text-[2rem]" markClassName="size-9" />
          <p className="font-display mt-6 text-2xl tracking-tight">
            See where your money is today.
          </p>
          <Link to="/signup" className={cn(INK_BUTTON, "mt-6 h-12 px-6 text-base")}>
            Create your free account
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-8">
          <FooterLinks title="Product">
            <a href="#features">Features</a>
            <a href="#security">Security</a>
          </FooterLinks>
          <FooterLinks title="Account">
            <Link to="/login">Sign in</Link>
            <Link to="/signup">Create account</Link>
          </FooterLinks>
        </div>
      </div>
      <div
        className={cn(
          CONTAINER,
          "flex flex-wrap justify-between gap-2 pb-8 text-sm text-[#5f5f6e]",
        )}
      >
        <p>© 2026 Spark</p>
        <p>Personal finance for UK bank accounts and cards. Built on Open Banking.</p>
      </div>
    </footer>
  );
}

function FooterLinks({ title, children }: { title: string; children: ReactNode }) {
  return (
    <nav aria-label={title}>
      <p className="text-sm text-[#5f5f6e]">{title}</p>
      <div className="mt-4 flex flex-col items-start gap-3 text-lg [&>a:hover]:text-[#5f5f6e]">
        {children}
      </div>
    </nav>
  );
}
