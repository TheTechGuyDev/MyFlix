"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { episodesFor, img, similarTo, type Maturity, type Title } from "@/lib/catalog";
import type { LibraryApi } from "@/lib/library";
import { metaLine } from "./TitleCard";
import { CheckIcon, CloseIcon, PlayIcon, PlusIcon, ThumbIcon, VolumeIcon } from "./icons";

type Props = {
  title: Title;
  kids: boolean;
  max?: Maturity;
  library: LibraryApi;
  onClose: () => void;
  onPlay: (t: Title, season?: number, episode?: number) => void;
  onOpen: (t: Title) => void;
};

export default function DetailsModal({ title: t, kids, max = "18+", library, onClose, onPlay, onOpen }: Props) {
  const [season, setSeason] = useState(1);
  const inList = library.lib.list.includes(t.id);
  const rating = library.lib.ratings[t.id];
  const progress = library.lib.progress[t.id];
  const similar = similarTo(t, kids, max);

  useEffect(() => {
    setSeason(1);
    document.getElementById("details-modal")?.scrollTo({ top: 0 });
  }, [t.id]);

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
    <div id="details-modal" role="dialog" aria-modal="true" aria-labelledby="details-title" className="fixed inset-0 z-50 overflow-y-auto bg-black/70" onClick={onClose}>
      <div className="mx-auto min-h-full w-full max-w-4xl bg-ink-2 pb-10 shadow-2xl sm:my-8 sm:min-h-0 sm:rounded-lg" onClick={(e) => e.stopPropagation()}>
        {/* Banner */}
        <div className="relative aspect-video w-full overflow-hidden sm:rounded-t-lg">
          <Image src={img(t.image, 1280, 720)} alt="" fill sizes="900px" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-2 via-ink-2/10 to-transparent" />
          <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-ink-2 hover:bg-ink-3">
            <CloseIcon className="h-6 w-6" />
          </button>
          <div className="absolute bottom-6 left-5 right-5 sm:bottom-10 sm:left-12">
            <h2 id="details-title" className="font-display text-5xl leading-none sm:text-7xl">{t.title}</h2>
            <div className="mt-4 flex items-center gap-2">
              <button onClick={() => onPlay(t)} className="flex items-center gap-2 rounded bg-white px-5 py-2 font-bold text-ink hover:bg-white/80 sm:px-7 sm:text-lg">
                <PlayIcon className="h-6 w-6" /> {progress ? "Resume" : "Play"}
              </button>
              <CircleBtn label={inList ? "Remove from My List" : "Add to My List"} onClick={() => library.toggleList(t.id)}>
                {inList ? <CheckIcon /> : <PlusIcon />}
              </CircleBtn>
              <CircleBtn label="Not for me" active={rating === -1} onClick={() => library.rate(t.id, -1)}>
                <ThumbIcon className="h-5 w-5 rotate-180" filled={rating === -1} />
              </CircleBtn>
              <CircleBtn label="I like this" active={rating === 1} onClick={() => library.rate(t.id, 1)}>
                <ThumbIcon filled={rating === 1} />
              </CircleBtn>
              <CircleBtn label="Love this" active={rating === 2} onClick={() => library.rate(t.id, 2)}>
                <span className="flex"><ThumbIcon className="h-4 w-4" filled={rating === 2} /><ThumbIcon className="-ml-1.5 h-4 w-4" filled={rating === 2} /></span>
              </CircleBtn>
              <span className="ml-auto hidden h-10 w-10 items-center justify-center rounded-full border-2 border-white/40 text-white/70 sm:flex" aria-hidden>
                <VolumeIcon />
              </span>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="grid gap-6 px-5 pt-4 sm:grid-cols-[2fr_1fr] sm:px-12">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-brand-bright">{t.match}% Match</span>
              <span className="text-white/70">{t.year}</span>
              <span className="text-white/70">{metaLine(t)}</span>
              <span className="rounded-sm border border-white/40 px-1 text-[10px] font-bold">{t.quality}</span>
              <span className="rounded-sm border border-white/40 px-1 text-[10px] font-bold">AD</span>
            </div>
            <span className="mt-2 inline-block border border-white/40 px-1.5 text-sm">{t.maturity}</span>
            {progress && (
              <div className="mt-3 flex items-center gap-3 text-sm text-white/70">
                <span className="h-1 w-40 rounded bg-white/25"><span className="block h-full rounded bg-brand-bright" style={{ width: `${progress.pct}%` }} /></span>
                {t.type === "series" ? `S${progress.season}:E${progress.episode}` : `${progress.pct}% watched`}
              </div>
            )}
            <p className="mt-4 text-base leading-relaxed">{t.synopsis}</p>
          </div>
          <div className="space-y-3 text-sm">
            <p><span className="text-white/50">Cast: </span>{t.cast.join(", ")}</p>
            <p><span className="text-white/50">Genres: </span>{t.genres.join(", ")}</p>
            <p><span className="text-white/50">This {t.type === "series" ? "show" : "film"} is: </span>{t.tags.join(", ")}</p>
          </div>
        </div>

        {/* Episodes */}
        {t.type === "series" && (
          <div className="mt-10 px-5 sm:px-12">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-2xl font-bold">Episodes</h3>
              {(t.seasons ?? 1) > 1 && (
                <select value={season} onChange={(e) => setSeason(Number(e.target.value))} className="rounded border border-white/40 bg-ink-3 px-3 py-2 text-base outline-none">
                  {Array.from({ length: t.seasons ?? 1 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>Season {i + 1}</option>
                  ))}
                </select>
              )}
            </div>
            <ol>
              {episodesFor(t, season).map((ep) => (
                <li key={ep.number}>
                  <button onClick={() => onPlay(t, season, ep.number)} className="group flex w-full items-center gap-4 border-b border-white/10 px-2 py-5 text-left hover:bg-white/5 sm:px-6">
                    <span className="hidden w-6 shrink-0 text-2xl text-white/60 sm:block">{ep.number}</span>
                    <span className="relative aspect-video w-28 shrink-0 overflow-hidden rounded sm:w-36">
                      <Image src={img(t.image, 300, 170)} alt="" fill sizes="150px" className="object-cover" />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition group-hover:opacity-100">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-black/50"><PlayIcon className="h-4 w-4" /></span>
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex justify-between gap-2 font-semibold"><span>{ep.number}. {ep.title}</span><span className="shrink-0 font-normal text-white/70">{ep.runtime}</span></span>
                      <span className="mt-1 line-clamp-2 block text-sm text-white/70">{ep.synopsis}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* More like this */}
        {similar.length > 0 && (
          <div className="mt-10 px-5 sm:px-12">
            <h3 className="mb-4 text-2xl font-bold">More Like This</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {similar.map((s) => {
                const added = library.lib.list.includes(s.id);
                return (
                  <div key={s.id} className="overflow-hidden rounded bg-ink-3">
                    <button onClick={() => onOpen(s)} className="relative block aspect-video w-full" aria-label={s.title}>
                      <Image src={img(s.image, 400, 225)} alt="" fill sizes="280px" className="object-cover" />
                      <span className="absolute right-2 top-2 text-xs font-semibold">{metaLine(s)}</span>
                      <span className="font-display absolute bottom-1.5 left-2 text-xl drop-shadow">{s.title}</span>
                    </button>
                    <div className="p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">
                          <span className="font-semibold text-brand-bright">{s.match}% Match</span>
                          <span className="ml-2 border border-white/40 px-1 text-[10px]">{s.maturity}</span>
                        </span>
                        <CircleBtn small label={added ? "Remove from My List" : "Add to My List"} onClick={() => library.toggleList(s.id)}>
                          {added ? <CheckIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
                        </CircleBtn>
                      </div>
                      <p className="mt-2 line-clamp-3 text-xs text-white/70">{s.synopsis}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-10 border-t border-white/10 px-5 pt-6 text-sm sm:px-12">
          <h3 className="mb-3 text-xl"><b>About</b> {t.title}</h3>
          <p className="mb-1"><span className="text-white/50">Cast: </span>{t.cast.join(", ")}</p>
          <p className="mb-1"><span className="text-white/50">Genres: </span>{t.genres.join(", ")}</p>
          <p><span className="text-white/50">Maturity rating: </span><span className="border border-white/40 px-1">{t.maturity}</span></p>
        </div>
      </div>
    </div>
  );
}

function CircleBtn({ children, label, onClick, active, small }: { children: React.ReactNode; label: string; onClick: () => void; active?: boolean; small?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex shrink-0 items-center justify-center rounded-full border-2 bg-ink-2/60 transition hover:border-white ${small ? "h-8 w-8" : "h-10 w-10"} ${active ? "border-white" : "border-white/50"}`}
    >
      {children}
    </button>
  );
}
