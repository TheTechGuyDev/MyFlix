"use client";

/** Smart TV "Sign in with phone": the TV shows a code, a signed-in phone/computer approves it. */
import { fn, sb } from "./supabase";
import { refreshAccount } from "./store";

export const formatTvCode = (c: string) => c.replace(/\D/g, "").slice(0, 8).replace(/(\d{4})(\d)/, "$1 $2");

export const createTvCode = () => fn<{ code: string; secret: string; expires_in: number }>("tv", { action: "create" });

/** Polls once. When approved, signs this TV in and returns true. */
export async function pollTvCode(code: string, secret: string): Promise<"waiting" | "expired" | "approved"> {
  const r = await fn<{ status: string; token_hash?: string }>("tv", { action: "poll", code, secret });
  if (r.status === "approved" && r.token_hash) {
    const { error } = await sb().auth.verifyOtp({ token_hash: r.token_hash, type: "magiclink" });
    if (error) return "expired";
    await refreshAccount();
    return "approved";
  }
  return r.status === "expired" || r.status === "used" ? "expired" : "waiting";
}

export async function approveTvCode(code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await fn("tv", { action: "approve", code });
    await refreshAccount();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't sign the TV in." };
  }
}
