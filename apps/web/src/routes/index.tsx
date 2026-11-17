import type { ReactNode } from "react";

import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight } from "lucide-react";

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

const INK_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-md bg-[#0b0b0f] font-medium text-white transition-colors hover:bg-[#2a2a2f] focus-visible:ring-[3px] focus-visible:ring-[#e9618f]/50 outline-none";

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#e3e3eb] bg-white/85 backdrop-blur-md">
      <div className="flex h-16 items-center gap-10 px-4 sm:px-5">
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
          <Link to="/signup" className={cn(INK_BUTTON, "h-11 px-5 text-[0.9375rem]")}>
            Get started
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}

/** Tall outlined tile with the arrow on top and the label at the foot. */
function ArrowTile({
  to,
  children,
  tone = "light",
  className,
}: {
  to: "/signup" | "/login";
  children: ReactNode;
  tone?: "light" | "dark";
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "group flex flex-col justify-between rounded-md border p-4 transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-[#e9618f]/50",
        tone === "light"
          ? "border-[#0b0b0f] hover:bg-[#0b0b0f] hover:text-white"
          : "border-white/40 text-white hover:border-white hover:bg-white hover:text-[#0b0b0f]",
        className,
      )}
    >
      <ArrowUpRight
        strokeWidth={1.25}
        className="size-7 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
      />
      <span className="text-[1.0625rem] font-medium">{children}</span>
    </Link>
  );
}

function Hero() {
  return (
    <section className="relative flex flex-col justify-end lg:min-h-[min(calc(100svh-4rem),56rem)]">
      <SparkLines
        animate
        className="absolute inset-x-0 top-0 h-80 w-full [mask-image:linear-gradient(black_55%,transparent)] sm:h-[26rem] lg:inset-y-0 lg:h-full lg:[mask-image:none] [&_path]:stroke-[3.25] sm:[&_path]:stroke-[2.5] lg:[&_path]:stroke-[1.25]"
      />
      <div className="relative px-4 pt-72 pb-14 sm:px-5 sm:pt-96 lg:pt-40 lg:pb-16">
        <h1 className="headline text-[clamp(3rem,7.4vw,7.25rem)] leading-[0.98]">
          Every account.
          <br />
          One clear picture.
        </h1>
        <p className="mt-7 max-w-xl text-lg leading-relaxed sm:text-xl">
          Spark connects your current accounts, savings and credit cards through Open Banking, sorts
          every transaction, and shows what you're worth and where your money goes.
        </p>
        <div className="mt-10 flex flex-wrap items-end gap-x-8 gap-y-4">
          <ArrowTile to="/signup" className="h-28 w-56 bg-white">
            Get started free
          </ArrowTile>
          <p className="pb-1 text-[0.9375rem] text-[#5f5f6e]">
            Already using Spark?{" "}
            <Link to="/login" className="text-[#0b0b0f] underline underline-offset-4">
              Sign in
            </Link>
          </p>
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
      <div className="px-4 py-20 sm:px-5 sm:py-28">
        <p className="font-display mx-auto max-w-5xl text-center text-[1.75rem] leading-[1.15] tracking-[-0.02em] text-balance sm:text-[2.5rem] lg:text-[3rem]">
          Spark reads your accounts through regulated Open Banking, files every payment under the
          right category, and keeps one live picture of what you have, what you owe and where it
          goes.
        </p>
        <div className="mt-16 grid gap-5 sm:mt-20 sm:grid-cols-2">
          {SECTIONS.map((section) => (
            <a
              key={section.href}
              href={section.href}
              className="group flex min-h-52 flex-col justify-between rounded-md border border-white/25 p-6 transition-colors outline-none hover:border-white/60 hover:bg-white/[0.03] focus-visible:ring-[3px] focus-visible:ring-[#e9618f]/50 sm:min-h-60"
            >
              <ArrowUpRight
                strokeWidth={1.25}
                className="size-8 self-end transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
              <span>
                <span className="font-display block text-3xl tracking-tight sm:text-[2.25rem]">
                  {section.title}
                </span>
                <span className="mt-2 block text-[0.9375rem] text-white/70">{section.body}</span>
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function Story() {
  return (
    <section id="features" className="scroll-mt-16">
      <div className="px-4 pt-24 pb-14 sm:px-5 sm:pt-32 sm:pb-20">
        <h2 className="headline max-w-4xl text-[2.75rem] sm:text-6xl">
          From raw transactions to a clear picture.
        </h2>
      </div>
      <ProductStory />
    </section>
  );
}

const FACTS = [
  { label: "To use Spark", figure: "£0" },
  { label: "Banking passwords Spark sees", figure: "0" },
  { label: "To connect a bank", figure: "~1 min" },
  { label: "Current, savings and cards", figure: "3 kinds" },
] as const;

function Facts() {
  return (
    <section className="border-t border-[#0b0b0f]">
      <div className="px-4 pt-24 pb-5 sm:px-5 sm:pt-32">
        <h2 className="headline max-w-3xl text-[2.75rem] sm:text-6xl">
          Your money, on your terms.
        </h2>
        <p className="mt-6 max-w-xl text-lg leading-relaxed">
          Free to use, and nothing to install. You approve access at your own bank, see everything
          in one place, and can revoke it whenever you like.
        </p>
        <div className="mt-12 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-5">
          {FACTS.map((fact) => (
            <div
              key={fact.label}
              className="bg-ink flex h-36 flex-col justify-between rounded-md p-4 text-white sm:h-40 sm:p-5"
            >
              <p className="text-sm text-white/85 sm:text-[0.9375rem]">{fact.label}</p>
              <p className="font-display text-ignition w-fit text-4xl tracking-tight sm:text-5xl">
                {fact.figure}
              </p>
            </div>
          ))}
          <ArrowTile to="/signup" className="col-span-2 h-36 sm:h-40 lg:col-span-1">
            Create your account
          </ArrowTile>
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

function SecurityBand() {
  return (
    <section id="security" className="scroll-mt-16 px-4 pt-0 pb-24 sm:px-5 sm:pb-32">
      <div
        className="grid gap-10 overflow-hidden rounded-md px-6 py-14 text-white sm:px-12 sm:py-20 lg:grid-cols-[1fr_1.1fr] lg:gap-16"
        style={{
          background:
            "radial-gradient(70% 130% at 18% 0%, #b25260 0%, #4a2630 48%, #111214 88%), #111214",
        }}
      >
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
              className="flex items-start gap-3 border-t border-white/20 py-4 text-[0.9375rem] text-white/90"
            >
              <ArrowRight className="mt-0.5 size-4 shrink-0 text-[#f6a58a]" />
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
      <div className="grid gap-12 px-4 pt-16 pb-10 sm:px-5 sm:pt-20 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <SparkLogo className="[&>span:last-child]:text-[2rem]" markClassName="size-9" />
          <p className="font-display mt-6 text-2xl tracking-tight">
            See where your money is today.
          </p>
          <ArrowTile to="/signup" className="mt-6 h-24 w-56">
            Create your account
          </ArrowTile>
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
      <div className="flex flex-wrap justify-between gap-2 px-4 pb-8 text-sm text-[#5f5f6e] sm:px-5">
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
