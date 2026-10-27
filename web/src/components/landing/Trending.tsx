"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { trending, unsplash, type TrendingTitle } from "@/lib/landing-data";

export default function Trending() {
  const rowRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);
  const [active, setActive] = useState<TrendingTitle | null>(null);

  const updateArrows = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 8);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    updateArrows();
    window.addEventListener("resize", updateArrows);
    return () => window.removeEventListener("resize", updateArrows);
  }, [updateArrows]);

  const scroll = (dir: 1 | -1) => {
    const el = rowRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-8 lg:px-12">
      <h2 className="mb-4 text-xl font-bold sm:text-2xl">Trending Now</h2>
      <div className="group relative">
        {canLeft && (
          <button
            aria-label="Scroll left"
            onClick={() => scroll(-1)}
            className="absolute -left-2 top-0 z-10 hidden h-full w-8 items-center justify-center rounded-lg bg-ink-3/90 text-white transition hover:bg-line sm:flex"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 5-7 7 7 7" /></svg>
          </button>
        )}
        <div
          ref={rowRef}
          onScroll={updateArrows}
          className="no-scrollbar flex snap-x gap-4 overflow-x-auto scroll-smooth pb-2 sm:gap-6"
        >
          {trending.map((t, i) => (
            <button
              key={t.id}
              onClick={() => setActive(t)}
              className="relative flex shrink-0 snap-start items-end text-left outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label={`${i + 1}. ${t.title}`}
            >
              <span
                aria-hidden
                className="rank-number font-display -mr-4 select-none text-[90px] leading-[0.8] sm:-mr-6 sm:text-[130px]"
              >
                {i + 1}
              </span>
              <span className="relative block h-[150px] w-[104px] overflow-hidden rounded-lg transition duration-300 hover:scale-105 sm:h-[230px] sm:w-[160px]">
                <Image src={unsplash(t.image, 400)} alt="" fill sizes="160px" className="object-cover" />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent px-2 pb-2 pt-10">
                  <span className="block text-[10px] font-bold uppercase tracking-widest text-brand-bright">
                    MyFlix {t.type}
                  </span>
                  <span className="font-display block text-lg leading-none text-white sm:text-2xl">{t.title}</span>
                </span>
              </span>
            </button>
          ))}
        </div>
        {canRight && (
          <button
            aria-label="Scroll right"
            onClick={() => scroll(1)}
            className="absolute -right-2 top-0 z-10 hidden h-full w-8 items-center justify-center rounded-lg bg-ink-3/90 text-white transition hover:bg-line sm:flex"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 5 7 7-7 7" /></svg>
          </button>
        )}
      </div>

      {active && <TitleModal title={active} onClose={() => setActive(null)} />}
    </section>
  );
}

function TitleModal({ title, onClose }: { title: TrendingTitle; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="title-modal-heading"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-xl bg-ink-2 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative aspect-video w-full">
          <Image src={unsplash(title.image, 1200)} alt="" fill sizes="700px" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-2 via-ink-2/30 to-transparent" />
          <h3 id="title-modal-heading" className="font-display absolute bottom-4 left-6 text-5xl leading-none sm:text-6xl">
            {title.title}
          </h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white transition hover:bg-black"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <div className="px-6 pb-7 pt-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className="rounded bg-ink-3 px-2 py-0.5">{title.year}</span>
            <span className="rounded bg-ink-3 px-2 py-0.5">{title.rating}</span>
            <span className="rounded bg-ink-3 px-2 py-0.5">{title.type}</span>
            {title.genres.map((g) => (
              <span key={g} className="rounded bg-ink-3 px-2 py-0.5">{g}</span>
            ))}
          </div>
          <p className="mt-4 text-base leading-relaxed text-white/90">{title.synopsis}</p>
          <Link
            href="/signup"
            className="mt-6 inline-flex h-12 items-center gap-2 rounded bg-brand px-6 text-lg font-semibold text-white transition hover:bg-brand-hover"
          >
            Get Started
            <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 5 7 7-7 7" /></svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
