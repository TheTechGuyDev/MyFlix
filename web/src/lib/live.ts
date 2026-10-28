"use client";

/** Concurrent streams ("Too many people are using your account"), enforced in the database. */
import { sb } from "./supabase";

export type LiveStream = { id: string; profile: string; device: string; title: string };
export type Claim = { ok: true; max_height?: number } | { ok: false; reason: "screens" | "stopped" | "membership" | "suspended" | "profile" | "signin"; limit?: number; others?: LiveStream[]; by?: string };

export async function claim(id: string, profileId: string, device: string, titleId: string): Promise<Claim> {
  const { data, error } = await sb().rpc("claim_stream", { p_id: id, p_profile: profileId, p_device: device, p_title: titleId });
  if (error) return { ok: true }; // network blip: don't interrupt playback
  return data as Claim;
}

export const stopStream = (id: string) => sb().rpc("stop_stream", { p_id: id });
export const release = (id: string) => void sb().rpc("end_stream", { p_id: id });

export function deviceName() {
  if (typeof navigator === "undefined") return "Browser";
  const ua = navigator.userAgent;
  if (/SMART-TV|Tizen|Web0S|TV;/i.test(ua) || location.pathname.includes("/tv")) return "Smart TV";
  const browser = /Edg/.test(ua) ? "Edge" : /Chrome/.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : /Firefox/.test(ua) ? "Firefox" : "Browser";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iPhone" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows PC" : "Linux";
  return `${browser} on ${os}`;
}
