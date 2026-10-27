// "Sign in with phone" for Smart TVs.
//   create  (TV, no sign-in)  -> { code, secret }
//   poll    (TV)              -> { status, token_hash, email }   the TV then calls auth.verifyOtp
//   approve (signed-in phone) -> links the code to that member's account
import { fail, HttpError, json, serve } from "../_shared/cors.ts";
import { admin, requireUser } from "../_shared/supabase.ts";

const sha = async (s: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))), (b) => b.toString(16).padStart(2, "0")).join("");

serve(async (req) => {
  const b = await req.json().catch(() => ({}));

  if (b.action === "create") {
    const secret = crypto.randomUUID() + crypto.randomUUID();
    for (let i = 0; i < 5; i++) {
      const code = String(10000000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 90000000));
      const { error } = await admin.from("tv_codes").insert({ code, secret_hash: await sha(secret) });
      if (!error) return json({ code, secret, expires_in: 900 });
    }
    throw new HttpError(500, "Couldn't create a code. Try again.");
  }

  if (b.action === "poll") {
    const { data: c } = await admin.from("tv_codes").select("*").eq("code", String(b.code ?? "")).single();
    if (!c || c.secret_hash !== (await sha(String(b.secret ?? "")))) throw new HttpError(404, "Unknown code.");
    if (new Date(c.expires_at) < new Date()) return json({ status: "expired" });
    if (!c.token_hash || c.consumed_at) return json({ status: c.consumed_at ? "used" : "waiting" });
    await admin.from("tv_codes").update({ consumed_at: new Date().toISOString() }).eq("code", c.code);
    const { data: acc } = await admin.from("accounts").select("email").eq("id", c.approved_by).single();
    return json({ status: "approved", token_hash: c.token_hash, email: acc?.email });
  }

  if (b.action === "approve") {
    const user = await requireUser(req);
    const code = String(b.code ?? "").replace(/\D/g, "");
    if (code.length !== 8) throw new HttpError(400, "Enter the 8 digits shown on your TV.");
    const { data: c } = await admin.from("tv_codes").select("*").eq("code", code).single();
    if (!c || new Date(c.expires_at) < new Date()) throw new HttpError(400, "That code isn't valid or has expired. Check the code on your TV.");
    if (c.approved_by) throw new HttpError(400, "This code was already used. Ask the TV for a new one.");
    const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: user.email! });
    if (error) throw new HttpError(500, "Couldn't sign the TV in. Try again.");
    await admin.from("tv_codes").update({ approved_by: user.id, approved_at: new Date().toISOString(), token_hash: link.properties.hashed_token }).eq("code", code);
    await admin.from("devices").upsert({ id: `tv-${code}`, account_id: user.id, name: "MyFlix on Smart TV", kind: "tv" });
    return json({ ok: true });
  }

  return fail("Unknown action.");
});
