"use client";

/**
 * Concurrent stream registry ("Too many people are using your account").
 * Each playing screen writes a heartbeat; a stream counts as active for 30 seconds after its last beat.
 * Shared with the admin dashboard (Live Now) on the same site. With Supabase this becomes a
 * `streams` table with a realtime channel and a server-side check before the licence is issued.
 */
import { getPlan } from "./plans";

export type LiveStream = {
  id: string;
  email: string;
  profile: string;
  device: string;
  titleId: string;
  title: string;
  startedAt: string;
  beat: number;
  stoppedBy?: "admin" | "member";
};

const KEY = "myflix.live";
export const STALE_MS = 30000;

const readAll = (): Record<string, LiveStream> => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
};
const writeAll = (v: Record<string, LiveStream>) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
};

export function deviceName() {
  if (typeof navigator === "undefined") return "Browser";
  const ua = navigator.userAgent;
  if (/SMART-TV|Tizen|Web0S|TV;/i.test(ua) || location.pathname.includes("/tv")) return "Smart TV";
  const browser = /Edg/.test(ua) ? "Edge" : /Chrome/.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : /Firefox/.test(ua) ? "Firefox" : "Browser";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iPhone" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows PC" : "Linux";
  return `${browser} on ${os}`;
}

export const activeStreams = (email?: string) => {
  const now = Date.now();
  return Object.values(readAll()).filter((s) => now - s.beat < STALE_MS && !s.stoppedBy && (!email || s.email === email));
};

export const screensFor = (planId?: string) => getPlan(planId)?.screens ?? 1;

export function enforced() {
  try {
    const s = JSON.parse(localStorage.getItem("myflix.admin.settings") ?? "{}");
    return s.streamLimitEnforced !== false;
  } catch {
    return true;
  }
}

/** Tries to start (or keep) a stream. Returns the other active streams if the plan limit is reached. */
export function claim(s: Omit<LiveStream, "beat" | "startedAt">, planId?: string): { ok: true } | { ok: false; others: LiveStream[]; limit: number } {
  const all = readAll();
  const now = Date.now();
  // Clean up stale entries
  for (const k of Object.keys(all)) if (now - all[k].beat > STALE_MS * 4) delete all[k];
  const mine = all[s.id];
  if (mine?.stoppedBy) return { ok: false, others: [], limit: -1 };
  const others = Object.values(all).filter((x) => x.id !== s.id && x.email === s.email && !x.stoppedBy && now - x.beat < STALE_MS);
  const limit = screensFor(planId);
  if (!mine && enforced() && others.length >= limit) return { ok: false, others, limit };
  all[s.id] = { ...s, startedAt: mine?.startedAt ?? new Date().toISOString(), beat: now };
  writeAll(all);
  return { ok: true };
}

export function release(id: string) {
  const all = readAll();
  delete all[id];
  writeAll(all);
}

/** Stops another stream (member from the blocked screen, or admin from Live Now). */
export function stopStream(id: string, by: "admin" | "member") {
  const all = readAll();
  if (all[id]) {
    all[id].stoppedBy = by;
    writeAll(all);
  }
}

export const wasStopped = (id: string) => readAll()[id]?.stoppedBy ?? null;
