import { useEffect, useRef, useState, type ComponentType } from "react";

import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  ConnectIllustration,
  TrackIllustration,
  UnderstandIllustration,
} from "./StoryIllustrations";

interface Chapter {
  id: string;
  name: string;
  title: string;
  body: string;
  rows: readonly string[];
  Illustration: ComponentType;
}

const CHAPTERS: readonly Chapter[] = [
  {
    id: "connect",
    name: "Connect",
    title: "Link your banks in about a minute.",
    body: "Pick your bank and approve access in its own app. Spark connects through TrueLayer's regulated Open Banking service, so your banking password never touches Spark.",
    rows: [
      "Current accounts, savings and credit cards",
      "Reconnect in a couple of taps, with your history kept",
      "A heads-up before bank access needs renewing",
    ],
    Illustration: ConnectIllustration,
  },
  {
    id: "track",
    name: "Track",
    title: "Every transaction, sorted for you.",
    body: "Payments arrive with a category and a clean merchant name. Fix one and turn it into a rule, and Spark gets it right from then on.",
    rows: [
      "Automatic categories, plus your own",
      "Rules for the merchants you see every month",
      "Search and filter by account, category or date",
    ],
    Illustration: TrackIllustration,
  },
  {
    id: "understand",
    name: "Understand",
    title: "See where your money goes.",
    body: "Home shows what you're worth, how this month is going and your biggest spending categories, without a spreadsheet in sight.",
    rows: [
      "Net worth over time, across every account",
      "Money in and out, month by month",
      "Spending by category, this month against last",
    ],
    Illustration: UnderstandIllustration,
  },
];

/**
 * The product story: on wide screens a sticky ink panel shows the chapter in
 * view while the copy scrolls beside it; on phones each chapter carries its
 * own illustration.
 */
export function ProductStory() {
  const [active, setActive] = useState(0);
  const chapterRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    // The active chapter is the last one whose top has passed the middle of
    // the screen (the first until then), so it is right in either direction.
    let frame = 0;
    const update = () => {
      frame = 0;
      const middle = window.innerHeight / 2;
      let index = 0;
      chapterRefs.current.forEach((element, i) => {
        if (element && element.getBoundingClientRect().top <= middle) index = i;
      });
      setActive(index);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="grid border-t border-[#0b0b0f] lg:grid-cols-2">
      <div className="hidden lg:block">
        {/* Exactly the viewport below the 4rem header while it is stuck. */}
        <div className="bg-ink sticky top-16 flex h-[calc(100svh-4rem)] flex-col">
          <div className="relative flex-1">
            {CHAPTERS.map((chapter, index) => (
              <div
                key={chapter.id}
                className={cn(
                  "absolute inset-0 flex items-center justify-center transition-[opacity,translate] duration-500",
                  index === active ? "opacity-100" : "pointer-events-none translate-y-3 opacity-0",
                )}
              >
                <chapter.Illustration />
              </div>
            ))}
          </div>
          <ol className="grid grid-cols-3 gap-1.5 px-5 pb-5">
            {CHAPTERS.map((chapter, index) => (
              <li key={chapter.id}>
                <a
                  href={`#${chapter.id}`}
                  aria-current={index === active ? "step" : undefined}
                  className="group block text-xs text-white/75 hover:text-white"
                >
                  {chapter.name}
                  <span
                    className={cn(
                      "mt-2 block h-2 rounded-[3px] transition-colors duration-500",
                      index === active ? "bg-ignition" : "bg-white/20 group-hover:bg-white/35",
                    )}
                  />
                </a>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div>
        {CHAPTERS.map((chapter, index) => (
          <article
            key={chapter.id}
            id={chapter.id}
            ref={(element) => {
              chapterRefs.current[index] = element;
            }}
            className="flex scroll-mt-16 flex-col justify-center border-b border-[#0b0b0f] py-14 last:border-b-0 lg:min-h-[calc(100svh-4rem)] lg:pl-14 lg:py-20"
          >
            <p className="self-end text-sm text-[#5f5f6e] tabular-nums">
              {String(index + 1).padStart(2, "0")} – {String(CHAPTERS.length).padStart(2, "0")}
            </p>
            <div className="bg-ink mt-6 flex justify-center overflow-hidden rounded-lg px-4 pt-10 pb-8 lg:hidden">
              <chapter.Illustration />
            </div>
            <h3 className="headline mt-8 max-w-lg text-4xl sm:text-5xl lg:mt-4">{chapter.title}</h3>
            <p className="mt-5 max-w-lg text-[1.0625rem] leading-relaxed text-[#2c2c35]">
              {chapter.body}
            </p>
            <ul className="mt-8 max-w-lg">
              {chapter.rows.map((row) => (
                <li
                  key={row}
                  className="flex items-start gap-3 border-t border-[#e3e3eb] py-3.5 text-[0.9375rem] first:border-t-[#0b0b0f]"
                >
                  <ArrowRight className="text-primary mt-0.5 size-4 shrink-0" />
                  {row}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
