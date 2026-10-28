"use client";

/** Per-profile library on Supabase: My List, ratings and watch progress (synced across devices). */
import { useCallback, useEffect, useState } from "react";
import { sb } from "./supabase";

export type Rating = -1 | 1 | 2; // not for me, like, love
export type Progress = { pct: number; time?: number; duration?: number; season?: number; episode?: number; updatedAt: string };
export type Library = { list: string[]; ratings: Record<string, Rating>; progress: Record<string, Progress> };

const empty: Library = { list: [], ratings: {}, progress: {} };
const cache = new Map<string, Library>();

export async function loadLibrary(profileId: string): Promise<Library> {
  const c = sb();
  const [list, ratings, progress] = await Promise.all([
    c.from("my_list").select("title_id, added_at").eq("profile_id", profileId).order("added_at", { ascending: false }),
    c.from("ratings").select("title_id, rating").eq("profile_id", profileId),
    c.from("progress").select("*").eq("profile_id", profileId),
  ]);
  const lib: Library = {
    list: (list.data ?? []).map((r) => r.title_id as string),
    ratings: Object.fromEntries((ratings.data ?? []).map((r) => [r.title_id, r.rating as Rating])),
    progress: Object.fromEntries(
      (progress.data ?? []).map((r) => [r.title_id, { pct: r.pct, time: r.position, duration: r.duration ?? undefined, season: r.season ?? undefined, episode: r.episode ?? undefined, updatedAt: r.updated_at }]),
    ),
  };
  cache.set(profileId, lib);
  return lib;
}

/** Saved progress for a title (call loadLibrary first; the player does). */
export function readProgress(profileId: string, titleId: string): Progress | undefined {
  return cache.get(profileId)?.progress[titleId];
}

/** Save or clear (pass null) progress for a title. */
export function writeProgress(profileId: string, titleId: string, p: Omit<Progress, "updatedAt"> | null) {
  const lib = cache.get(profileId) ?? { ...empty, progress: {} };
  if (p === null) {
    delete lib.progress[titleId];
    void sb().from("progress").delete().eq("profile_id", profileId).eq("title_id", titleId);
  } else {
    lib.progress[titleId] = { ...p, updatedAt: new Date().toISOString() };
    void sb()
      .from("progress")
      .upsert({ profile_id: profileId, title_id: titleId, season: p.season ?? null, episode: p.episode ?? null, position: p.time ?? 0, duration: p.duration ?? null, pct: p.pct, updated_at: new Date().toISOString() });
  }
  cache.set(profileId, lib);
}

export function useLibrary(profileId: string | null, _seed: string[] = []) {
  void _seed;
  const [lib, setLib] = useState<Library>(() => (profileId && cache.get(profileId)) || empty);

  useEffect(() => {
    if (!profileId) return;
    let off = false;
    loadLibrary(profileId).then((l) => !off && setLib({ ...l }));
    return () => {
      off = true;
    };
  }, [profileId]);

  const update = useCallback(
    (fn: (l: Library) => Library) => {
      if (!profileId) return;
      setLib((prev) => {
        const next = fn(prev);
        cache.set(profileId, next);
        return next;
      });
    },
    [profileId],
  );

  const toggleList = useCallback(
    (id: string) => {
      if (!profileId) return;
      update((l) => {
        const on = l.list.includes(id);
        if (on) void sb().from("my_list").delete().eq("profile_id", profileId).eq("title_id", id);
        else void sb().from("my_list").insert({ profile_id: profileId, title_id: id });
        return { ...l, list: on ? l.list.filter((x) => x !== id) : [id, ...l.list] };
      });
    },
    [update, profileId],
  );

  const rate = useCallback(
    (id: string, r: Rating) =>
      update((l) => {
        const ratings = { ...l.ratings };
        if (ratings[id] === r) {
          delete ratings[id];
          void sb().from("ratings").delete().eq("profile_id", profileId!).eq("title_id", id);
        } else {
          ratings[id] = r;
          void sb().from("ratings").upsert({ profile_id: profileId!, title_id: id, rating: r, rated_at: new Date().toISOString() });
        }
        return { ...l, ratings };
      }),
    [update, profileId],
  );

  const removeProgress = useCallback(
    (id: string) =>
      update((l) => {
        const progress = { ...l.progress };
        delete progress[id];
        void sb().from("progress").delete().eq("profile_id", profileId!).eq("title_id", id);
        return { ...l, progress };
      }),
    [update, profileId],
  );

  return { lib, toggleList, rate, removeProgress };
}

export type LibraryApi = ReturnType<typeof useLibrary>;
