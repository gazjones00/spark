import type { ReactNode } from "react";

import { Link } from "@tanstack/react-router";
import { Check, ShieldCheck } from "lucide-react";

import { SparkLogo, SparkMark } from "@/components/spark-mark";

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  description: string;
}

/** Sign-in and sign-up: the form, with a brand panel beside it on wide screens. */
export function AuthLayout({ children, title, description }: AuthLayoutProps) {
  return (
    <div className="bg-background grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <BrandPanel />
      <div className="relative flex flex-col px-4 py-6 sm:px-8">
        <div
          aria-hidden="true"
          className="bg-spark-glow pointer-events-none absolute inset-x-0 top-0 h-80 opacity-70 lg:hidden"
        />
        <Link
          to="/"
          aria-label="Back to the Spark homepage"
          className="relative self-start lg:hidden"
        >
          <SparkLogo />
        </Link>
        <main className="relative mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="headline text-3xl">{title}</h1>
          <p className="text-muted-foreground mt-2 text-[0.9375rem]">{description}</p>
          <div className="mt-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

const BRAND_POINTS = [
  "Current accounts, savings and credit cards in one view",
  "Every transaction categorised automatically",
  "Net worth, this month and where your money goes",
] as const;

function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-ink p-10 text-white lg:flex lg:flex-col xl:p-14">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 0% 0%, rgb(255 154 60 / 0.35), transparent 70%), radial-gradient(55% 55% at 100% 100%, rgb(138 92 255 / 0.55), transparent 70%), radial-gradient(40% 40% at 70% 30%, rgb(255 84 112 / 0.25), transparent 70%)",
        }}
      />
      <SparkMark
        mono
        className="pointer-events-none absolute -right-24 -bottom-24 size-[26rem] text-white/[0.06]"
      />

      <Link to="/" aria-label="Back to the Spark homepage" className="relative self-start">
        <SparkLogo className="[&>span:last-child]:text-white" />
      </Link>

      <div className="relative mt-auto max-w-md">
        <h2 className="headline text-4xl text-white xl:text-5xl">
          Your money,
          <br />
          all in one place.
        </h2>
        <ul className="mt-8 space-y-3">
          {BRAND_POINTS.map((point) => (
            <li key={point} className="flex items-start gap-3 text-[0.9375rem] text-white/85">
              <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-white/15">
                <Check className="size-3" />
              </span>
              {point}
            </li>
          ))}
        </ul>
      </div>

      <p className="relative mt-auto flex items-center gap-2 pt-10 text-sm text-white/70">
        <ShieldCheck className="size-4" />
        Read-only Open Banking. Spark can never move your money.
      </p>
    </aside>
  );
}
