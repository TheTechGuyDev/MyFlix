"use client";

/** Asks the server for this title's signed stream (checks membership and screen limit first). */
import type { Title } from "./catalog";
import { fn } from "./supabase";
import type { Claim } from "./live";

export type ResolvedMedia = { sources: string[]; subs: { label: string; src: string; lang: string }[]; intro?: { start: number; end: number }; poster?: string };
export type MediaResult = { ok: true; media: ResolvedMedia } | { ok: false; claim?: Claim; error?: string };

export async function resolveMedia(title: Title, season: number, episode: number, ctx: { streamId: string; profileId: string; device: string }): Promise<MediaResult> {
  try {
    const r = await fn<{ ok: boolean; sources?: string[]; poster?: string; intro?: { start: number; end: number } | null } & Record<string, unknown>>("playback", {
      title_id: title.id,
      season,
      episode,
      stream_id: ctx.streamId,
      profile_id: ctx.profileId,
      device: ctx.device,
    });
    if (!r.ok) return { ok: false, claim: r as unknown as Claim };
    const introSrc = title.type === "series" ? title.seasonsData?.find((s) => s.number === season)?.episodes.find((e) => e.number === episode) : title;
    const intro = r.intro ?? (introSrc?.introStart !== undefined && introSrc?.introEnd !== undefined ? { start: introSrc.introStart!, end: introSrc.introEnd! } : undefined);
    return {
      ok: true,
      media: {
        sources: r.sources ?? [],
        poster: r.poster,
        intro: intro ?? undefined,
        subs: (title.subtitles ?? []).filter((s) => s.url).map((s) => ({ label: s.label, src: s.url!, lang: s.lang })),
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "We couldn't start this title." };
  }
}
