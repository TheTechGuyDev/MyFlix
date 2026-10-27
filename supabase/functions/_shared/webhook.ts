import { env } from "./cors.ts";
import { timingSafeEqual } from "./paystack.ts";

/** Verifies Supabase Auth hook requests (Standard Webhooks signature). */
export async function verifyHook(req: Request, raw: string, secretEnv: string) {
  const secret = env(secretEnv).replace(/^v1,whsec_/, "");
  if (!secret) return false;
  const id = req.headers.get("webhook-id") ?? "";
  const ts = req.headers.get("webhook-timestamp") ?? "";
  const sigs = (req.headers.get("webhook-signature") ?? "").split(" ");
  if (!id || !ts || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const keyBytes = Uint8Array.from(atob(secret), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${ts}.${raw}`)));
  let b = "";
  mac.forEach((x) => (b += String.fromCharCode(x)));
  const expected = btoa(b);
  return sigs.some((s) => timingSafeEqual(s.replace(/^v1,/, ""), expected));
}
