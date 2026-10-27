// Optional Mux webhook (Mux dashboard > Settings > Webhooks). Uploads also sync without it.
import { env, json } from "../_shared/cors.ts";
import { saveAsset } from "../_shared/mux.ts";
import { timingSafeEqual } from "../_shared/paystack.ts";

async function valid(raw: string, header: string | null) {
  const secret = env("MUX_WEBHOOK_SECRET");
  if (!secret) return true; // not configured: rely on HTTPS + payload re-fetch is not needed for status-only updates
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${parts.t}.${raw}`)));
  const hex = Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
  return timingSafeEqual(hex, parts.v1 ?? "") && Math.abs(Date.now() / 1000 - Number(parts.t)) < 600;
}

Deno.serve(async (req) => {
  const raw = await req.text();
  if (!(await valid(raw, req.headers.get("mux-signature")))) return new Response("bad signature", { status: 401 });
  const event = JSON.parse(raw);
  if (["video.asset.ready", "video.asset.errored", "video.asset.created", "video.asset.static_renditions.ready"].includes(event.type)) await saveAsset(event.data);
  return json({ received: true });
});
