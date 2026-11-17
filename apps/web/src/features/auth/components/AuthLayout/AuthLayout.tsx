import type { ReactNode } from "react";

import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

import { SparkLines } from "@/components/spark-lines";
import { SparkLogo } from "@/components/spark-mark";

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
      <div className="relative isolate flex flex-col overflow-hidden px-4 py-6 sm:px-8">
        <SparkLines className="absolute inset-x-0 top-0 -z-10 h-64 w-full [mask-image:linear-gradient(black,transparent)] lg:hidden" />
        <Link to="/" aria-label="Back to the Spark homepage" className="self-start lg:hidden">
          <SparkLogo />
        </Link>
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="headline text-[2.5rem]">{title}</h1>
          <p className="text-muted-foreground mt-3 text-[0.9375rem]">{description}</p>
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
    <aside className="bg-ink relative hidden overflow-hidden p-10 text-white lg:flex lg:flex-col xl:p-14">
      <SparkLines
        animate
        className="absolute inset-x-0 top-0 h-[62%] w-full text-[rgb(214_170_105/0.55)] [mask-image:linear-gradient(black_55%,transparent)] [&_path]:stroke-[2]"
      />

      <Link to="/" aria-label="Back to the Spark homepage" className="relative self-start">
        <SparkLogo className="[&>span:last-child]:text-white" />
      </Link>

      <div className="relative mt-auto max-w-xl">
        <h2 className="headline text-5xl text-white xl:text-6xl">
          Every account.
          <br />
          One clear picture.
        </h2>
        <ul className="mt-10">
          {BRAND_POINTS.map((point) => (
            <li
              key={point}
              className="border-t border-white/15 py-3.5 text-[0.9375rem] text-white/85 last:border-b"
            >
              {point}
            </li>
          ))}
        </ul>
      </div>

      <p className="relative flex items-center gap-2 pt-10 text-sm text-white/70">
        <ShieldCheck className="size-4" />
        Read-only Open Banking. Spark can never move your money.
      </p>
    </aside>
  );
}
