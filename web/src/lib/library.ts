"use client";

/**
 * Per-profile library (My List, ratings, watch progress) stored in the browser.
 * Swap for Supabase tables later; the hook API stays the same.
 */
import { useCallback, useEffect, useState } from "react";

export type Rating = -1 | 1 | 2; // not for me, like, love
export type Progress = { pct: number; season?: number; episode?: number; updatedAt: string };
export type Library = {
  list: string[];
  ratings: Record<string, Rating>;
  progress: Record<string, Progress>;
  seeded?: boolean;
};

const empty: Library = { list: [], ratings: {}, progress: {} };
const key = (profileId: string) => `myflix.lib.${profileId}`;

function load(profileId: string): Library {
  try {
    const raw = localStorage.getItem(key(profileId));
    return raw ? { ...empty, ...JSON.parse(raw) } : { ...empty };
  } catch {
    return { ...empty };
  }
}

function save(profileId: string, lib: Library) {
  try {
    localStorage.setItem(key(profileId), JSON.stringify(lib));
  } catch {
    /* ignore */
  }
}

export function useLibrary(profileId: string | null, seedIds: string[] = []) {
  const [lib, setLib] = useState<Library>(empty);

  useEffect(() => {
    if (!profileId) return;
    let l = load(profileId);
    if (!l.seeded) {
      // Demo: give a fresh profile something in Continue Watching.
      const now = new Date().toISOString();
      const progress: Record<string, Progress> = {};
      seedIds.forEach((id, i) => (progress[id] = { pct: [35, 62, 18][i % 3], season: 1, episode: i + 2, updatedAt: now }));
      l = { ...l, progress: { ...progress, ...l.progress }, seeded: true };
      save(profileId, l);
    }
    setLib(l);
    // seedIds are static per kids/non-kids; intentionally only depend on profile
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  const update = useCallback(
    (fn: (l: Library) => Library) => {
      if (!profileId) return;
      setLib((prev) => {
        const next = fn(prev);
        save(profileId, next);
        return next;
      });
    },
    [profileId],
  );

  const toggleList = useCallback(
    (id: string) => update((l) => ({ ...l, list: l.list.includes(id) ? l.list.filter((x) => x !== id) : [id, ...l.list] })),
    [update],
  );

  const rate = useCallback(
    (id: string, r: Rating) =>
      update((l) => {
        const ratings = { ...l.ratings };
        if (ratings[id] === r) delete ratings[id];
        else ratings[id] = r;
        return { ...l, ratings };
      }),
    [update],
  );

  const removeProgress = useCallback(
    (id: string) =>
      update((l) => {
        const progress = { ...l.progress };
        delete progress[id];
        return { ...l, progress };
      }),
    [update],
  );

  return { lib, toggleList, rate, removeProgress };
}

export type LibraryApi = ReturnType<typeof useLibrary>;
