"use client";

import { catalog, episodesFor, type Title, type VideoAsset } from "./catalog";
import { getMediaUrl } from "./media";
import { sourcesFor } from "./streams";

export type ResolvedMedia = { sources: string[]; subs: { label: string; src: string; lang: string }[]; intro?: { start: number; end: number } };

/** Uploaded/URL video + subtitle files from the admin dashboard, with demo streams as fallback. */
export async function resolveMedia(title: Title, season: number, episode: number): Promise<ResolvedMedia> {
  const index = catalog.findIndex((t) => t.id === title.id);
  const ep = title.type === "series" ? episodesFor(title, season).find((e) => e.number === episode) : undefined;
  const asset: VideoAsset | undefined = title.type === "series" ? ep?.video : title.video;
  const first: string[] = [];
  if (asset?.source === "url" && asset.url) first.push(asset.url);
  if (asset?.source === "upload" && asset.mediaId) {
    const u = await getMediaUrl(asset.mediaId);
    if (u) first.push(u);
  }
  const subs: ResolvedMedia["subs"] = [];
  for (const s of title.subtitles ?? []) {
    const src = s.mediaId ? await getMediaUrl(s.mediaId) : s.url ?? null;
    if (src) subs.push({ label: s.label, src, lang: s.lang });
  }
  const introSrc = ep ?? title;
  const intro =
    introSrc.introStart !== undefined && introSrc.introEnd !== undefined
      ? { start: introSrc.introStart, end: introSrc.introEnd }
      : title.type === "series"
        ? { start: 5, end: 35 }
        : undefined;
  return { sources: [...first, ...sourcesFor(Math.max(0, index))], subs, intro };
}
