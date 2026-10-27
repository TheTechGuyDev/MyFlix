"use client";

import Image from "next/image";
import { img, type Title } from "@/lib/catalog";
import { InfoIcon, PlayIcon } from "./icons";

export default function Hero({ title: t, onPlay, onInfo }: { title: Title; onPlay: (t: Title) => void; onInfo: (t: Title) => void }) {
  return (
    <section className="relative h-[78vh] min-h-[460px] w-full overflow-hidden sm:h-[88vh] lg:h-[56.25vw] lg:max-h-[92vh]">
      <Image src={img(t.backdrop || t.image, 1920, 1080)} alt="" fill priority sizes="100vw" className="object-cover object-center" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/35 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-ink to-transparent" />

      <div className="absolute bottom-[22%] left-4 right-4 sm:bottom-[26%] lg:bottom-[30%] max-w-xl sm:left-10 lg:left-14">
        {t.original && (
          <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] text-white/90">
            <span className="font-display text-2xl tracking-normal text-brand-bright">M</span>
            {t.type === "series" ? "Series" : "Film"}
          </p>
        )}
        <h1 className="font-display text-6xl leading-[0.9] drop-shadow-lg sm:text-7xl lg:text-8xl">{t.title}</h1>
        <p className="mt-4 line-clamp-3 text-sm text-white/90 drop-shadow sm:text-lg">{t.synopsis}</p>
        <div className="mt-6 flex gap-3">
          <button onClick={() => onPlay(t)} className="flex items-center gap-2 rounded bg-white px-5 py-2 text-base font-bold text-ink transition hover:bg-white/75 sm:px-7 sm:py-2.5 sm:text-lg">
            <PlayIcon className="h-6 w-6 sm:h-7 sm:w-7" /> Play
          </button>
          <button onClick={() => onInfo(t)} className="flex items-center gap-2 rounded bg-white/25 px-5 py-2 text-base font-bold backdrop-blur-sm transition hover:bg-white/15 sm:px-7 sm:py-2.5 sm:text-lg">
            <InfoIcon className="h-6 w-6 sm:h-7 sm:w-7" /> More Info
          </button>
        </div>
      </div>

      <span className="absolute bottom-[32%] right-0 hidden border-l-4 border-white/80 bg-black/40 py-1.5 pl-3 pr-12 text-base sm:block">
        {t.maturity}
      </span>
    </section>
  );
}
