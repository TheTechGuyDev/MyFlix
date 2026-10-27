"use client";

/**
 * Smart TV pairing ("Sign in with phone") and the TV's own session.
 * The TV shows an 8-digit code; a signed-in phone or computer approves it from Account > Sign in on TV
 * (website) or My MyFlix > Sign in on TV (app). With Supabase this becomes a `tv_codes` table polled
 * (or subscribed to) by the TV.
 */
import type { Account } from "./mock-auth";

type Pending = { code: string; createdAt: number; exp: number; paired?: { email: string; at: string; via: "web" | "app" } };

const PENDING = "myflix.tv.pending";
const SESSION = "myflix.tv.session";
const APP_LINKS = "flutter.myflix.tv.links"; // written by the Flutter app (shared_preferences on web)
const CODE_TTL = 15 * 60000;

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

export const formatTvCode = (c: string) => c.replace(/\D/g, "").slice(0, 8).replace(/(\d{4})(\d)/, "$1 $2");

export function createTvCode(): string {
  const all = read<Record<string, Pending>>(PENDING, {});
  const now = Date.now();
  for (const k of Object.keys(all)) if (all[k].exp < now) delete all[k];
  let code = "";
  do code = String(Math.floor(10000000 + Math.random() * 90000000));
  while (all[code]);
  all[code] = { code, createdAt: now, exp: now + CODE_TTL };
  write(PENDING, all);
  return code;
}

/** Called from a signed-in phone/computer to approve the TV. */
export function pairTvCode(raw: string, email: string, via: "web" | "app" = "web"): { ok: true } | { ok: false; error: string } {
  const code = raw.replace(/\D/g, "");
  if (code.length !== 8) return { ok: false, error: "Enter the 8 digits shown on your TV." };
  const all = read<Record<string, Pending>>(PENDING, {});
  const p = all[code];
  if (!p || p.exp < Date.now()) return { ok: false, error: "That code isn't valid or has expired. Check the code on your TV, or ask the TV for a new one." };
  if (p.paired) return { ok: false, error: "This code was already used. Ask the TV for a new one." };
  p.paired = { email, at: new Date().toISOString(), via };
  write(PENDING, all);
  return { ok: true };
}

/** Polled by the TV. Returns the email once the code has been approved (website or app). */
export function checkTvCode(code: string): string | null {
  const p = read<Record<string, Pending>>(PENDING, {})[code];
  if (p?.paired) return p.paired.via === "app" ? `app:${p.paired.email}` : p.paired.email;
  // Flutter app (web preview) stores a JSON-encoded string list of links
  try {
    const raw = localStorage.getItem(APP_LINKS);
    if (raw) {
      const list = JSON.parse(JSON.parse(raw)) as { code: string; email: string }[];
      const hit = list.find((l) => l.code === code);
      if (hit) return `app:${hit.email}`;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export const codeExpired = (code: string) => {
  const p = read<Record<string, Pending>>(PENDING, {})[code];
  return !p || p.exp < Date.now();
};

/* ---------------- TV session ---------------- */
export type TvSession = { email: string; source: "web" | "app"; profileId?: string; pairedAt: string };

export const getTvSession = () => read<TvSession | null>(SESSION, null);
export const setTvSession = (s: TvSession | null) => (s ? write(SESSION, s) : localStorage.removeItem(SESSION));

/** Account for the TV: from the website's store, or the app's store when paired from the app preview. */
export function tvAccount(s: TvSession | null): Account | null {
  if (!s) return null;
  if (s.source === "web") return read<Record<string, Account>>("myflix.users", {})[s.email] ?? null;
  try {
    const raw = localStorage.getItem("flutter.myflix.users");
    const users = raw ? (JSON.parse(JSON.parse(raw)) as Record<string, Account>) : {};
    return users[s.email] ?? null;
  } catch {
    return null;
  }
}

/** Records the TV on the account's device list (website accounts). */
export function addTvDevice(email: string) {
  const users = read<Record<string, Account>>("myflix.users", {});
  const a = users[email];
  if (!a) return;
  a.devices = [...(a.devices ?? []), { id: `tv-${Date.now()}`, name: "MyFlix on Smart TV", location: "Lagos, Nigeria", lastUsed: new Date().toISOString() }];
  write("myflix.users", users);
}
