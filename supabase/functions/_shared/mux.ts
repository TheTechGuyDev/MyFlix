import { env, HttpError } from "./cors.ts";
import { admin } from "./supabase.ts";

const API = "https://api.mux.com";

export const muxConfigured = () => Boolean(env("MUX_TOKEN_ID") && env("MUX_TOKEN_SECRET"));

export async function mux(path: string, body?: unknown, method = body ? "POST" : "GET") {
  if (!muxConfigured()) throw new HttpError(503, "Video hosting isn't connected yet (MUX_TOKEN_ID / MUX_TOKEN_SECRET).");
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: "Basic " + btoa(`${env("MUX_TOKEN_ID")}:${env("MUX_TOKEN_SECRET")}`), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(502, data?.error?.messages?.join(" ") ?? "Video service error.");
  return data.data;
}

/* ---------------- Signed playback (JWT, RS256) ---------------- */
const b64url = (buf: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof buf === "string" ? new TextEncoder().encode(buf) : new Uint8Array(buf);
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

function derLen(n: number): number[] {
  if (n < 0x80) return [n];
  const out: number[] = [];
  while (n > 0) {
    out.unshift(n & 0xff);
    n >>= 8;
  }
  return [0x80 | out.length, ...out];
}

/** Wraps a PKCS#1 RSA key (what Mux returns) into PKCS#8 for WebCrypto. */
function pkcs1ToPkcs8(pkcs1: Uint8Array): Uint8Array {
  const algo = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
  const octet = [0x04, ...derLen(pkcs1.length), ...pkcs1];
  const inner = [0x02, 0x01, 0x00, ...algo, ...octet];
  return new Uint8Array([0x30, ...derLen(inner.length), ...inner]);
}

function pemToDer(pem: string): { der: Uint8Array; pkcs1: boolean } {
  const pkcs1 = pem.includes("BEGIN RSA PRIVATE KEY");
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const bin = atob(b64);
  return { der: Uint8Array.from(bin, (c) => c.charCodeAt(0)), pkcs1 };
}

let cachedKey: { id: string; key: CryptoKey } | null = null;

/** Signing key: from MUX_SIGNING_KEY_ID/PRIVATE_KEY secrets, or created once via the API and kept server-side. */
async function signingKey() {
  if (cachedKey) return cachedKey;
  let id = env("MUX_SIGNING_KEY_ID");
  let pemB64 = env("MUX_SIGNING_PRIVATE_KEY");
  if (!id || !pemB64) {
    const { data: sid } = await admin.rpc("get_private_secret", { p_name: "mux_signing_key_id" });
    const { data: spk } = await admin.rpc("get_private_secret", { p_name: "mux_signing_private_key" });
    if (sid && spk) {
      id = sid;
      pemB64 = spk;
    } else {
      const k = await mux("/system/v1/signing-keys", {});
      id = k.id;
      pemB64 = k.private_key;
      await admin.rpc("set_private_secret", { p_name: "mux_signing_key_id", p_value: id });
      await admin.rpc("set_private_secret", { p_name: "mux_signing_private_key", p_value: pemB64 });
    }
  }
  const pem = pemB64.includes("BEGIN") ? pemB64 : atob(pemB64);
  const { der, pkcs1 } = pemToDer(pem);
  const keyData = (pkcs1 ? pkcs1ToPkcs8(der) : der).slice().buffer as ArrayBuffer;
  const key = await crypto.subtle.importKey("pkcs8", keyData, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  cachedKey = { id, key };
  return cachedKey;
}

/** aud: v = video, t = thumbnail, s = storyboard. */
export async function signPlayback(playbackId: string, aud: "v" | "t" | "s", ttlSeconds: number, extra: Record<string, unknown> = {}) {
  const { id, key } = await signingKey();
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT", kid: id }));
  const payload = b64url(JSON.stringify({ sub: playbackId, aud, exp: Math.floor(Date.now() / 1000) + ttlSeconds, kid: id, ...extra }));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${payload}`));
  return `${header}.${payload}.${b64url(sig)}`;
}

/** Mux plays these names for max_resolution. */
export const resolutionFor = (height: number) => (height >= 2160 ? "2160p" : height >= 1440 ? "1440p" : height >= 1080 ? "1080p" : height >= 720 ? "720p" : "480p");

/** Writes a ready (or failed) Mux asset onto the title or episode it belongs to. */
export async function saveAsset(asset: { id: string; status: string; passthrough?: string; playback_ids?: { id: string; policy: string }[]; duration?: number; max_stored_resolution?: string; resolution_tier?: string; tracks?: { type: string; max_height?: number }[]; static_renditions?: { status?: string } }) {
  let target: { t?: string; e?: string } = {};
  try {
    target = JSON.parse(asset.passthrough ?? "{}");
  } catch {
    return;
  }
  if (!target.t) return;
  const height = asset.tracks?.find((x) => x.type === "video")?.max_height ?? 0;
  const pb = asset.playback_ids?.[0];
  const video = {
    provider: "mux",
    asset_id: asset.id,
    playback_id: pb?.id ?? null,
    policy: pb?.policy ?? "signed",
    status: asset.status === "ready" ? "ready" : asset.status === "errored" ? "error" : "processing",
    height,
    duration: asset.duration ?? null,
    tier: asset.resolution_tier ?? asset.max_stored_resolution ?? null,
    mp4: asset.static_renditions?.status === "ready",
    updated_at: new Date().toISOString(),
  };
  if (target.e) await admin.from("episodes").update({ video }).eq("id", target.e);
  else await admin.from("titles").update({ video, quality: height >= 2160 ? "4K" : "HD" }).eq("id", target.t);
}
