"use client";

/**
 * In-memory cache of everything the website shows, loaded from Supabase at start-up and kept
 * fresh on sign-in/sign-out. Components read it synchronously; writes go to Supabase first.
 */
import { useSyncExternalStore } from "react";
import type { Session } from "@supabase/supabase-js";
import { backendConfigured, sb } from "./supabase";
import { applyRemoteCatalog, type DbEpisode, type DbTitle } from "./catalog";
import { applyRemotePlans, type Plan } from "./plans";

export type DbAccount = {
  id: string;
  email: string;
  phone: string | null;
  pending_plan_id: string | null;
  plan_id: string | null;
  billing_cycle: "monthly" | "annual";
  status: "pending" | "active" | "past_due" | "cancelled" | "suspended";
  paid_until: string | null;
  cancel_at: string | null;
  credit: number;
  referral_code: string | null;
  referred_by: string | null;
  promo: { code: string; label?: string } | null;
  notifications: Record<string, boolean>;
  state: string | null;
  created_at: string;
};

export type DbProfile = {
  id: string;
  account_id: string;
  name: string;
  avatar: number;
  kids: boolean;
  settings: Record<string, unknown>;
  has_pin: boolean;
  sort: number;
  created_at: string;
};

export type DbPayment = { id: string; reference: string; amount: number; status: string; plan_id: string; cycle: string; channel: string | null; last4: string | null; paid_at: string | null; created_at: string };
export type Billing = { method: { last4: string | null; card_type: string | null; exp: string | null; bank: string | null; channel: string | null; reusable: boolean } | null; payments: DbPayment[] };
export type DbDevice = { id: string; name: string; kind: string; last_seen: string; location: string | null; revoked_at: string | null; created_at: string };

type State = {
  ready: boolean;
  publicReady: boolean;
  session: Session | null;
  account: DbAccount | null;
  profiles: DbProfile[];
  billing: Billing | null;
  devices: DbDevice[];
  settings: Record<string, unknown>;
  error: string | null;
};

let state: State = { ready: false, publicReady: false, session: null, account: null, profiles: [], billing: null, devices: [], settings: {}, error: null };
let version = 0;
const listeners = new Set<() => void>();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  version++;
  listeners.forEach((l) => l());
}

export const getState = () => state;

export function useStore<T>(select: (s: State) => T): T {
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => version,
    () => -1,
  );
  return select(state);
}

/* ---------------- Device id (for Devices page and remote sign-out) ---------------- */
export function deviceId() {
  try {
    let id = localStorage.getItem("myflix.deviceId");
    if (!id) {
      id = `web-${crypto.randomUUID()}`;
      localStorage.setItem("myflix.deviceId", id);
    }
    return id;
  } catch {
    return "web-unknown";
  }
}

export function deviceLabel() {
  const ua = navigator.userAgent;
  if (location.pathname.includes("/tv")) return "MyFlix on Smart TV";
  const browser = /Edg/.test(ua) ? "Edge" : /Chrome/.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : /Firefox/.test(ua) ? "Firefox" : "Browser";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iPhone" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows PC" : "Linux";
  return `${browser} on ${os}`;
}

/* ---------------- Loading ---------------- */
async function loadPublic() {
  const c = sb();
  const [settings, plans, titles, episodes, curation] = await Promise.all([
    c.from("site_settings").select("data").eq("id", 1).maybeSingle(),
    c.from("plans").select("*").eq("active", true).order("sort"),
    c.from("titles").select("*"),
    c.from("episodes").select("*").order("season").order("number"),
    c.from("curation").select("data").eq("id", 1).maybeSingle(),
  ]);
  if (plans.data) applyRemotePlans(plans.data as Plan[]);
  applyRemoteCatalog((titles.data ?? []) as DbTitle[], (episodes.data ?? []) as DbEpisode[], (curation.data?.data ?? null) as never);
  set({ settings: (settings.data?.data as Record<string, unknown>) ?? {}, publicReady: true });
}

/** Loads (or clears) the signed-in member's account, profiles, billing and devices. */
export async function refreshAccount() {
  const c = sb();
  const { data } = await c.auth.getSession();
  const session = data.session;
  if (!session) {
    set({ session: null, account: null, profiles: [], billing: null, devices: [] });
    return null;
  }
  const uid = session.user.id;
  const [acc, profiles, billing, devices] = await Promise.all([
    c.from("accounts").select("*").eq("id", uid).maybeSingle(),
    c.from("viewer_profiles").select("*").eq("account_id", uid).order("sort").order("created_at"),
    c.rpc("my_billing"),
    c.from("devices").select("*").eq("account_id", uid).is("revoked_at", null).order("last_seen", { ascending: false }),
  ]);
  set({
    session,
    account: (acc.data as DbAccount) ?? null,
    profiles: (profiles.data as DbProfile[]) ?? [],
    billing: (billing.data as Billing) ?? { method: null, payments: [] },
    devices: (devices.data as DbDevice[]) ?? [],
  });
  return state.account;
}

let booting: Promise<void> | null = null;

/** Runs once per page load. */
export function boot() {
  if (booting) return booting;
  if (!backendConfigured) {
    set({ ready: true, publicReady: true, error: "not-configured" });
    return (booting = Promise.resolve());
  }
  booting = (async () => {
    try {
      await Promise.all([loadPublic(), refreshAccount()]);
      // This browser was signed out remotely (Account > Devices or Admin)?
      if (state.account) {
        const { data: ok } = await sb().rpc("touch_device", { p_id: deviceId(), p_name: deviceLabel(), p_kind: location.pathname.includes("/tv") ? "tv" : "web" });
        if (ok === false) {
          await sb().auth.signOut({ scope: "local" });
          localStorage.removeItem("myflix.deviceId");
          await refreshAccount();
        }
      }
    } catch (e) {
      console.error(e);
      set({ error: "offline" });
    }
    set({ ready: true });
    sb().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") void refreshAccount();
    });
  })();
  return booting;
}

/** Reloads the catalogue (e.g. after a scheduled title goes live). */
export const reloadPublic = () => loadPublic();
