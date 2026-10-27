"use client";

import { useSyncExternalStore } from "react";

/**
 * Live view of a localStorage key written by the MyFlix site (outbox, live streams, TV codes).
 * Updates on storage events from other tabs and polls for time-based changes (stream heartbeats).
 */
const cache = new Map<string, { raw: string | null; val: unknown }>();

export function readLocal<T>(key: string, fallback: T): T {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    /* ignore */
  }
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.val as T;
  let val: unknown = fallback;
  try {
    val = raw ? JSON.parse(raw) : fallback;
  } catch {
    val = fallback;
  }
  cache.set(key, { raw, val });
  return val as T;
}

export function writeLocal(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event("myflix:local"));
}

export function useLocal<T>(key: string, fallback: T, pollMs = 0): T {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("storage", cb);
      window.addEventListener("myflix:local", cb);
      const id = pollMs ? setInterval(cb, pollMs) : null;
      return () => {
        window.removeEventListener("storage", cb);
        window.removeEventListener("myflix:local", cb);
        if (id) clearInterval(id);
      };
    },
    () => readLocal(key, fallback),
    () => fallback,
  );
}

/** A clock that ticks every `ms` (for "active now" calculations). */
export function useNow(ms = 5000) {
  return useSyncExternalStore(
    (cb) => {
      const id = setInterval(cb, ms);
      return () => clearInterval(id);
    },
    () => Math.floor(Date.now() / ms) * ms,
    () => 0,
  );
}

export type OutMsg = { id: string; channel: "email" | "sms" | "push"; kind: string; to: string; subject: string; body: string; link?: string; at: string };
export type LiveStream = { id: string; email: string; profile: string; device: string; titleId: string; title: string; startedAt: string; beat: number; stoppedBy?: "admin" | "member" };
export type TvCode = { code: string; createdAt: number; exp: number; paired?: { email: string; at: string; via: string } };
