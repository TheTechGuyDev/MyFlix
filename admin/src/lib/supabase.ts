"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_KEY ?? "";
export const backendConfigured = Boolean(url && key);

let client: SupabaseClient | null = null;
/** Admin uses its own session storage key, separate from the member website. */
export function sb(): SupabaseClient {
  if (!client) {
    client = createClient(url || "https://not-configured.supabase.co", key || "not-configured", {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce", storageKey: "myflix.admin.auth" },
    });
  }
  return client;
}

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
