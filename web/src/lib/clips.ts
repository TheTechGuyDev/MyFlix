"use client";

/**
 * Clips: a vertical feed of short moments from titles. Admins pick clips in Home Curation;
 * otherwise a default set is generated from titles that have video.
 */
import { allowedFor, byId, catalog, curation, type Clip, type Maturity, type Title } from "./catalog";
import { sb } from "./supabase";

export type { Clip } from "./catalog";

const CAPTIONS = ["This scene though", "Wait for it…", "No one saw this coming", "The way she said it!", "Plot twist alert", "Pure vibes", "When the music hits"];

export function defaultClips(): Clip[] {
  return catalog
    .filter((t) => !t.comingSoon && t.hasVideo)
    .slice(0, 14)
    .map((t, i) => ({ id: `c-${t.id}`, titleId: t.id, start: (i * 13) % 80, end: ((i * 13) % 80) + 22, caption: CAPTIONS[i % CAPTIONS.length] }));
}

export function clipsFor(kids: boolean, max: Maturity): { clip: Clip; title: Title }[] {
  const curated = curation()?.clips;
  const list = curated?.length ? curated : defaultClips();
  return list
    .map((clip) => ({ clip, title: byId(clip.titleId)! }))
    .filter((x) => x.title && !x.title.comingSoon && x.title.hasVideo && allowedFor(x.title, max) && (!kids || x.title.kids));
}

export async function reactionsOf(pid: string): Promise<string[]> {
  const { data } = await sb().from("clip_reactions").select("clip_id").eq("profile_id", pid);
  return (data ?? []).map((r) => r.clip_id);
}

export async function toggleReaction(pid: string, id: string, on: boolean) {
  if (on) await sb().from("clip_reactions").delete().eq("profile_id", pid).eq("clip_id", id);
  else await sb().from("clip_reactions").insert({ profile_id: pid, clip_id: id });
}
