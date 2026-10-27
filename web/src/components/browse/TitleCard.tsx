"use client";

import Image from "next/image";
import type { Title } from "@/lib/catalog";
import { img } from "@/lib/catalog";
import type { LibraryApi } from "@/lib/library";
import { CheckIcon, ChevronDown, PlayIcon, PlusIcon, ThumbIcon } from "./icons";

type Props = {
  title: Title;
  library: LibraryApi;
  onOpen: (t: Title) => void;
  onPlay: (t: Title) => void;
  rank?: number;
  showProgress?: boolean;
  fluid?: boolean;
};

export function metaLine(t: Title) {
  return t.type === "series" ? `${t.seasons} Season${t.seasons === 1 ? "" : "s"}` : t.runtime;
}

export default function TitleCard({ title: t, library, onOpen, onPlay, rank, showProgress, fluid }: Props) {
  const inList = library.lib.list.includes(t.id);
  const liked = (library.lib.ratings[t.id] ?? 0) > 0;
  const progress = library.lib.progress[t.id];

  const sizeCls = fluid ? "w-full" : "w-[44vw] sm:w-[30vw] md:w-[23vw] lg:w-[18.5vw] xl:w-[15.6vw]";

  return (
    <div className={`group/card relative shrink-0 snap-start ${rank ? "flex items-end" : ""}`}>
      {rank && (
        <span aria-hidden className="rank-number font-display -mr-3 select-none text-[96px] leading-[0.78] sm:text-[130px]">
          {rank}
        </span>
      )}
      <div className={`${rank ? "w-[28vw] sm:w-[18vw] lg:w-[12vw]" : sizeCls} relative`}>
        <button
          onClick={() => onOpen(t)}
          aria-label={t.title}
          className={`relative block w-full overflow-hidden rounded-md bg-ink-3 outline-none ring-white transition duration-300 focus-visible:ring-2 md:group-hover/card:scale-[1.06] md:group-hover/card:shadow-2xl md:group-hover/card:shadow-black ${
            rank ? "aspect-[2/3]" : "aspect-video"
          }`}
        >
          <Image
            src={rank ? img(t.image, 400, 600) : img(t.image, 640, 360)}
            alt=""
            fill
            sizes="(max-width: 640px) 45vw, 20vw"
            className="object-cover"
          />
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-2.5 pb-2 pt-8 text-left">
            {t.original && <span className="block text-[9px] font-bold uppercase tracking-[0.2em] text-brand-bright">MyFlix Original</span>}
            <span className="font-display block text-xl leading-none text-white sm:text-2xl">{t.title}</span>
          </span>
          {t.isNew && !rank && (
            <span className="absolute left-2 top-2 rounded-sm bg-brand px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">New</span>
          )}
          {showProgress && progress && (
            <span className="absolute inset-x-2.5 bottom-1.5 h-1 rounded bg-white/30">
              <span className="block h-full rounded bg-brand-bright" style={{ width: `${progress.pct}%` }} />
            </span>
          )}
        </button>

        {/* Hover panel (desktop) */}
        <div className="pointer-events-none absolute inset-x-0 top-full z-10 hidden translate-y-1 rounded-b-md bg-ink-2 p-3 opacity-0 shadow-2xl shadow-black transition duration-200 md:block md:group-hover/card:pointer-events-auto md:group-hover/card:translate-y-0 md:group-hover/card:opacity-100">
          <div className="flex items-center gap-1.5">
            <button onClick={() => onPlay(t)} aria-label="Play" className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-ink hover:bg-white/80">
              <PlayIcon className="h-4 w-4" />
            </button>
            <button onClick={() => library.toggleList(t.id)} aria-label={inList ? "Remove from My List" : "Add to My List"} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white/50 hover:border-white">
              {inList ? <CheckIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
            </button>
            <button onClick={() => library.rate(t.id, 1)} aria-label="I like this" className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white/50 hover:border-white">
              <ThumbIcon className="h-4 w-4" filled={liked} />
            </button>
            <button onClick={() => onOpen(t)} aria-label="More info" className="ml-auto flex h-8 w-8 items-center justify-center rounded-full border-2 border-white/50 hover:border-white">
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className="font-semibold text-brand-bright">{t.match}% Match</span>
            <span className="border border-white/40 px-1 text-[10px]">{t.maturity}</span>
            <span className="text-white/80">{metaLine(t)}</span>
            <span className="rounded-sm border border-white/40 px-1 text-[9px] font-bold">{t.quality}</span>
          </div>
          <p className="mt-1.5 truncate text-xs text-white/80">{t.tags.concat(t.genres.slice(0, 1)).join(" • ")}</p>
        </div>
      </div>
    </div>
  );
}
