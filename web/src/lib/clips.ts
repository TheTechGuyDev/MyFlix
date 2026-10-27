"use client";

/**
 * Clips: a vertical feed of short moments from titles (like Netflix's mobile "Clips" / "Fast Laughs").
 * Admins pick clips in Home Curation > Clips feed; otherwise a default set is generated.
 */
import { allowedFor, byId, catalog, type Maturity, type Title } from "./catalog";
import { getMediaUrl } from "./media";
import { DEMO_MP4 } from "./streams";

export type Clip = { id: string; titleId: string; start: number; end: number; caption: string };

const read = <T,>(k: string, f: T): T => {
  try {
    const r = localStorage.getItem(k);
    return r ? (JSON.parse(r) as T) : f;
  } catch {
    return f;
  }
};
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* ignore */
  }
};

const CAPTIONS = ["This scene though 😂", "Wait for it…", "No one saw this coming", "The way she said it!", "Lagos traffic be like", "Plot twist alert", "Pure vibes", "When the music hits"];

export function defaultClips(): Clip[] {
  return catalog
    .filter((t) => !t.comingSoon)
    .slice(0, 14)
    .map((t, i) => ({ id: `c-${t.id}`, titleId: t.id, start: (i * 13) % 80, end: ((i * 13) % 80) + 22, caption: CAPTIONS[i % CAPTIONS.length] }));
}

export function clipsFor(kids: boolean, max: Maturity): { clip: Clip; title: Title }[] {
  const curated = read<{ clips?: Clip[] }>("myflix.admin.curation", {}).clips;
  const list = curated?.length ? curated : defaultClips();
  return list
    .map((clip) => ({ clip, title: byId(clip.titleId)! }))
    .filter((x) => x.title && !x.title.comingSoon && allowedFor(x.title, max) && (!kids || x.title.kids));
}

/** Uploaded/linked progressive video for the title, else the demo clip hosted with the site. */
export async function clipSource(t: Title): Promise<string> {
  const v = t.video ?? t.seasonsData?.[0]?.episodes?.[0]?.video;
  if (v?.source === "upload" && v.mediaId) {
    const u = await getMediaUrl(v.mediaId);
    if (u) return u;
  }
  if (v?.source === "url" && v.url && !/\.m3u8/i.test(v.url)) return v.url;
  return DEMO_MP4;
}

/* Reactions */
export const reactionsOf = (pid: string) => read<string[]>(`myflix.clipReacts.${pid}`, []);
export function toggleReaction(pid: string, id: string) {
  const l = reactionsOf(pid);
  const next = l.includes(id) ? l.filter((x) => x !== id) : [...l, id];
  write(`myflix.clipReacts.${pid}`, next);
  return next;
}
export const baseLaughs = (id: string) => {
  let h = 0;
  for (const c of id) h = (h * 33 + c.charCodeAt(0)) >>> 0;
  return 800 + (h % 24000);
};
export const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : String(n));
