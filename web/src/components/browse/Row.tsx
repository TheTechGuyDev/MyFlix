"use client";

import { useT } from "@/lib/i18n";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RowDef, Title } from "@/lib/catalog";
import type { LibraryApi } from "@/lib/library";
import TitleCard from "./TitleCard";
import { ChevronLeft, ChevronRight } from "./icons";

type Props = { row: RowDef; library: LibraryApi; onOpen: (t: Title) => void; onPlay: (t: Title) => void };

export default function Row({ row, library, onOpen, onPlay }: Props) {
  const tx = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [left, setLeft] = useState(false);
  const [right, setRight] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setLeft(el.scrollLeft > 4);
    setRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [update, row.items.length]);

  const go = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.9, behavior: "smooth" });

  return (
    <section className="group/row relative" aria-label={row.title}>
      <h2 className="mb-2 px-4 text-lg font-bold sm:px-10 sm:text-xl lg:px-14">{tx(row.title)}</h2>
      <div className="relative">
        {left && (
          <button onClick={() => go(-1)} aria-label="Previous" className="absolute bottom-28 left-0 top-3 z-20 hidden w-10 items-center justify-center bg-black/60 opacity-0 transition hover:bg-black/80 group-hover/row:opacity-100 sm:flex lg:w-14">
            <ChevronLeft className="h-8 w-8" />
          </button>
        )}
        <div
          ref={ref}
          onScroll={update}
          className="no-scrollbar flex snap-x gap-2 overflow-x-auto scroll-px-4 px-4 pb-28 pt-3 sm:scroll-px-10 sm:px-10 lg:scroll-px-14 lg:px-14 -mb-24"
        >
          {row.items.map((t, i) => (
            <TitleCard key={t.id} title={t} library={library} onOpen={onOpen} onPlay={onPlay} rank={row.ranked ? i + 1 : undefined} showProgress={row.progress} />
          ))}
        </div>
        {right && (
          <button onClick={() => go(1)} aria-label="Next" className="absolute bottom-28 right-0 top-3 z-20 hidden w-10 items-center justify-center bg-black/60 opacity-0 transition hover:bg-black/80 group-hover/row:opacity-100 sm:flex lg:w-14">
            <ChevronRight className="h-8 w-8" />
          </button>
        )}
      </div>
    </section>
  );
}
