// Unit tests for security-critical edge function helpers (run by the Supabase workflow).
import { generateKeyPairSync, verify } from "node:crypto";
import { Buffer } from "node:buffer";

Deno.env.set("SUPABASE_URL", "http://localhost");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test");
Deno.env.set("PAYSTACK_SECRET_KEY", "sk_test_abc");
const hookSecret = btoa("supersecretkeybytes1234567890abc");
Deno.env.set("SEND_EMAIL_HOOK_SECRET", `v1,whsec_${hookSecret}`);

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
Deno.env.set("MUX_SIGNING_KEY_ID", "kid123");
Deno.env.set("MUX_SIGNING_PRIVATE_KEY", btoa(privateKey.export({ type: "pkcs1", format: "pem" }) as string));

const { signPlayback, resolutionFor } = await import("../functions/_shared/mux.ts");
const { verifySignature, timingSafeEqual } = await import("../functions/_shared/paystack.ts");
const { verifyHook } = await import("../functions/_shared/webhook.ts");

const assert = (c: unknown, m: string) => {
  if (!c) throw new Error(m);
};

Deno.test("Mux playback token is a valid RS256 JWT with plan resolution cap", async () => {
  const t = await signPlayback("pb123", "v", 60, { max_resolution: resolutionFor(720) });
  const [h, p, s] = t.split(".");
  const ok = verify("RSA-SHA256", new TextEncoder().encode(`${h}.${p}`), publicKey, Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64"));
  assert(ok, "signature does not verify");
  const claims = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/")));
  assert(claims.sub === "pb123" && claims.aud === "v" && claims.max_resolution === "720p", "wrong claims");
  assert(claims.exp > Date.now() / 1000, "already expired");
});

Deno.test("resolution caps per plan", () => {
  assert(resolutionFor(480) === "480p" && resolutionFor(1080) === "1080p" && resolutionFor(2160) === "2160p", "mapping");
});

Deno.test("Paystack webhook signature accepted and tampering rejected", async () => {
  const body = '{"event":"charge.success"}';
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("sk_test_abc"), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const hex = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body))), (b) => b.toString(16).padStart(2, "0")).join("");
  assert(await verifySignature(body, hex), "valid rejected");
  assert(!(await verifySignature(body + " ", hex)), "tampered accepted");
  assert(!(await verifySignature(body, null)), "missing accepted");
});

Deno.test("Auth hook signature accepted, tampered and stale rejected", async () => {
  const body = '{"x":1}';
  const id = "msg_1";
  const sign = async (ts: string) => {
    const key = await crypto.subtle.importKey("raw", Uint8Array.from(atob(hookSecret), (c) => c.charCodeAt(0)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${ts}.${body}`)));
    return "v1," + btoa(String.fromCharCode(...mac));
  };
  const now = String(Math.floor(Date.now() / 1000));
  const mk = (ts: string, sig: string) => new Request("http://x", { method: "POST", headers: { "webhook-id": id, "webhook-timestamp": ts, "webhook-signature": sig } });
  assert(await verifyHook(mk(now, await sign(now)), body, "SEND_EMAIL_HOOK_SECRET"), "valid rejected");
  assert(!(await verifyHook(mk(now, "v1,AAAA"), body, "SEND_EMAIL_HOOK_SECRET")), "tampered accepted");
  const old = String(Math.floor(Date.now() / 1000) - 3600);
  assert(!(await verifyHook(mk(old, await sign(old)), body, "SEND_EMAIL_HOOK_SECRET")), "stale accepted");
});

Deno.test("timing-safe compare", () => {
  assert(timingSafeEqual("abc", "abc") && !timingSafeEqual("abc", "abd") && !timingSafeEqual("abc", "ab"), "compare");
});
