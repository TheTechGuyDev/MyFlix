"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_KEY ?? "";

/** True when the site was built with the Supabase project's URL and publishable key. */
export const backendConfigured = Boolean(url && key);

let client: SupabaseClient | null = null;

/** The browser Supabase client (session stored in this browser, refreshed automatically). */
export function sb(): SupabaseClient {
  if (!client) {
    client = createClient(url || "https://not-configured.supabase.co", key || "not-configured", {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce", storageKey: "myflix.auth" },
    });
  }
  return client;
}

/** Calls an edge function and returns its JSON, throwing the function's own error message. */
export async function fn<T = Record<string, unknown>>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await sb().functions.invoke(name, { body });
  if (error) {
    let msg = "Something went wrong. Please try again.";
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx) msg = ((await ctx.json()) as { error?: string }).error ?? msg;
    } catch {
      /* keep default */
    }
    throw new Error(msg);
  }
  return data as T;
}

/** Site address including the GitHub Pages base path, for auth redirects. */
export const siteUrl = (path = "") => {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  if (typeof window === "undefined") return `${base}${path}`;
  return `${window.location.origin}${base}${path}`;
};

export const friendly = (e: unknown) => (e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : "Something went wrong. Please try again.");
