"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { img, type Title } from "@/lib/catalog";
import { baseLaughs, clipSource, clipsFor, compact, reactionsOf, toggleReaction, type Clip } from "@/lib/clips";
import { useT } from "@/lib/i18n";
import { useLibrary } from "@/lib/library";
import { getAccount, getActiveProfileId, settingsOf, type Profile } from "@/lib/mock-auth";

export default function ClipsFeed() {
  const router = useRouter();
  const tx = useT();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);
  const [reacts, setReacts] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const acc = getAccount();
    if (!acc) return router.replace("/login");
    if (!acc.payment) return router.replace("/signup/payment");
    const p = acc.profiles.find((x) => x.id === getActiveProfileId());
    if (!p) return router.replace("/profiles");
    setProfile(p);
    setReacts(reactionsOf(p.id));
  }, [router]);

  const library = useLibrary(profile?.id ?? null);
  const items = useMemo(() => (profile ? clipsFor(profile.kids, settingsOf(profile).maturity) : []), [profile]);

  // Which clip is on screen
  useEffect(() => {
    const root = feedRef.current;
    if (!root || !items.length) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(Number((e.target as HTMLElement).dataset.index))),
      { root, threshold: 0.6 },
    );
    root.querySelectorAll("[data-index]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items.length]);

  // Keyboard: up/down between clips, M to mute
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const root = feedRef.current;
      if (!root) return;
      if (e.key === "ArrowDown" || e.key === "j") root.scrollBy({ top: root.clientHeight, behavior: "smooth" });
      if (e.key === "ArrowUp" || e.key === "k") root.scrollBy({ top: -root.clientHeight, behavior: "smooth" });
      if (e.key === "m") setMuted((m) => !m);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 2500);
    return () => clearTimeout(id);
  }, [notice]);

  if (!profile) return <div className="fixed inset-0 bg-black" />;

  const share = (c: Clip, t: Title) => {
    const base = `${location.origin}${location.pathname.replace(/\/clips\/?$/, "")}`;
    const url = `${base}/watch/?id=${t.id}&t=${c.start}`;
    if (navigator.share) navigator.share({ title: t.title, text: c.caption, url }).catch(() => {});
    else navigator.clipboard?.writeText(url).then(() => setNotice("Link copied."));
  };

  return (
    <div className="fixed inset-0 bg-black text-white">
      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-4 py-4">
        <Link href="/browse" aria-label="Back to browse" className="pointer-events-auto rounded-full p-2 hover:bg-white/10">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 5l-7 7 7 7" /></svg>
        </Link>
        <p className="text-lg font-bold">{tx("Clips")}</p>
        <button onClick={() => setMuted(!muted)} aria-label={muted ? "Unmute" : "Mute"} className="pointer-events-auto rounded-full p-2 hover:bg-white/10">
          {muted ? (
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor" /><path d="m16 9 5 6M21 9l-5 6" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor" /><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" /></svg>
          )}
        </button>
      </div>

      {notice && <div role="status" className="absolute left-1/2 top-20 z-30 -translate-x-1/2 rounded bg-white px-4 py-2 text-sm font-medium text-ink">{notice}</div>}

      <div ref={feedRef} className="h-full snap-y snap-mandatory overflow-y-scroll [scrollbar-width:none]">
        {items.map(({ clip, title }, i) => {
          const on = reacts.includes(clip.id);
          const inList = library.lib.list.includes(title.id);
          return (
            <section key={clip.id} data-index={i} className="relative flex h-full snap-start snap-always items-center justify-center overflow-hidden">
              {/* Blurred backdrop for wide screens */}
              <Image src={img(title.image, 400, 700)} alt="" fill sizes="100vw" className="scale-110 object-cover opacity-40 blur-2xl" />
              <div className="relative h-full w-full sm:aspect-[9/16] sm:w-auto sm:max-w-[480px]">
                {Math.abs(i - active) <= 1 ? (
                  <ClipVideo clip={clip} title={title} playing={i === active} muted={muted} onTap={() => setMuted(!muted)} />
                ) : (
                  <Image src={img(title.image, 500, 900)} alt="" fill sizes="480px" className="object-cover" />
                )}
                {muted && i === active && (
                  <button onClick={() => setMuted(false)} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/60 px-4 py-2 text-sm font-semibold">
                    🔇 {tx("Tap for sound")}
                  </button>
                )}

                {/* Actions */}
                <div className="absolute bottom-28 right-3 z-10 flex flex-col items-center gap-5 text-xs font-semibold">
                  <button onClick={() => setReacts(toggleReaction(profile.id, clip.id))} className="flex flex-col items-center gap-1" aria-pressed={on}>
                    <span className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl transition ${on ? "scale-110 bg-brand" : "bg-black/50"}`}>😂</span>
                    {compact(baseLaughs(clip.id) + (on ? 1 : 0))}
                  </button>
                  <button onClick={() => library.toggleList(title.id)} className="flex flex-col items-center gap-1">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-2xl">{inList ? "✓" : "+"}</span>
                    {tx("My List")}
                  </button>
                  <button onClick={() => share(clip, title)} className="flex flex-col items-center gap-1">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50">
                      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v14" /></svg>
                    </span>
                    {tx("Share")}
                  </button>
                </div>

                {/* Title info */}
                <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black via-black/70 to-transparent px-4 pb-6 pt-16">
                  <p className="mb-1 text-sm text-white/80">{clip.caption}</p>
                  <p className="font-display text-4xl leading-none">{title.title}</p>
                  <p className="mt-1 text-xs text-white/70">{title.genres.slice(0, 3).join(" • ")} · {title.maturity}</p>
                  <div className="mt-3 flex gap-2">
                    <Link href={`/watch?id=${title.id}&t=${clip.start}`} className="flex flex-1 items-center justify-center gap-2 rounded bg-white py-2 text-sm font-bold text-ink">▶ {tx("Watch now")}</Link>
                    <Link href={`/browse?title=${title.id}`} className="flex flex-1 items-center justify-center rounded bg-white/20 py-2 text-sm font-semibold">{tx("More Info")}</Link>
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function ClipVideo({ clip, title, playing, muted, onTap }: { clip: Clip; title: Title; playing: boolean; muted: boolean; onTap: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let off = false;
    clipSource(title).then((s) => !off && setSrc(s));
    return () => {
      off = true;
    };
  }, [title]);

  useEffect(() => {
    const v = ref.current;
    if (!v || !src) return;
    if (playing) {
      if (v.currentTime < clip.start || v.currentTime > clip.end) v.currentTime = clip.start;
      v.play().catch(() => {});
    } else v.pause();
  }, [playing, src, clip.start, clip.end]);

  return (
    <>
      <video
        ref={ref}
        src={src ?? undefined}
        poster={img(title.image, 500, 900)}
        muted={muted}
        playsInline
        preload="metadata"
        controlsList="nodownload"
        onContextMenu={(e) => e.preventDefault()}
        onClick={onTap}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          // Keep the clip inside the video's length
          if (clip.start > v.duration) v.currentTime = 0;
          else v.currentTime = clip.start;
        }}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          const end = Math.min(clip.end, v.duration || clip.end);
          const start = clip.start > (v.duration || 0) ? 0 : clip.start;
          if (v.currentTime >= end) v.currentTime = start;
          setProgress(Math.max(0, Math.min(1, (v.currentTime - start) / Math.max(1, end - start))));
        }}
        className="h-full w-full object-cover"
      />
      <div className="absolute inset-x-0 bottom-0 z-20 h-0.5 bg-white/20">
        <div className="h-full bg-brand-bright" style={{ width: `${progress * 100}%` }} />
      </div>
    </>
  );
}
