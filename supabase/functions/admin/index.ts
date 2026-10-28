// Staff operations that need the service role. Every call checks the staff member's permission
// (with two-step sign-in) and is written to the audit log.
import { env, fail, HttpError, json, serve, site } from "../_shared/cors.ts";
import { admin, audit, requireStaff, requireUser } from "../_shared/supabase.ts";
import { applyPayment, forgetPaystackKey, paystack } from "../_shared/paystack.ts";
import { layout, sendEmail } from "../_shared/messages.ts";

serve(async (req) => {
  const b = await req.json().catch(() => ({}));

  // First sign-in: the owner email (ADMIN_OWNER_EMAIL secret) becomes Super Admin if no staff exist yet.
  if (b.action === "bootstrap") {
    const user = await requireUser(req);
    const { count } = await admin.from("staff").select("user_id", { count: "exact", head: true });
    if ((count ?? 0) > 0) {
      const { data: me } = await admin.from("staff").select("user_id").eq("user_id", user.id).maybeSingle();
      return json({ staff: Boolean(me) });
    }
    const owner = env("ADMIN_OWNER_EMAIL").trim().toLowerCase();
    if (!owner || (user.email ?? "").toLowerCase() !== owner) throw new HttpError(403, "This account isn't MyFlix staff.");
    await admin.from("staff").insert({ user_id: user.id, name: "Platform Owner", email: user.email, role_id: "super" });
    await audit(user.id, "Platform Owner", "Created owner account", user.email ?? "");
    return json({ staff: true, created: true });
  }

  if (b.action === "invite_staff") {
    const { user, name } = await requireStaff(req, "staff");
    const email = String(b.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new HttpError(400, "Enter a valid email.");
    const { data: role } = await admin.from("roles").select("id").eq("id", b.role_id).single();
    if (!role) throw new HttpError(400, "Choose a role.");
    let uid: string | undefined;
    const { data: existing } = await admin.from("accounts").select("id").eq("email", email).maybeSingle();
    if (existing) uid = existing.id;
    else {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: `${site()}/admin/login/?invite=1` });
      if (error) throw new HttpError(400, error.message);
      uid = data.user.id;
    }
    const { error } = await admin.from("staff").upsert({ user_id: uid, name: String(b.name ?? email), email, role_id: role.id, active: true });
    if (error) throw new HttpError(400, error.message);
    await sendEmail(email, "You've been added to MyFlix Admin", layout("Welcome to the MyFlix team", `${name} added you as staff. Sign in to the admin dashboard with this email. You'll set up two-step verification with an authenticator app on first sign-in.`, { label: "Open MyFlix Admin", url: `${site()}/admin/login/` }), "staff");
    await audit(user.id, name, "Invited staff", `${email} (${role.id})`);
    return json({ ok: true, user_id: uid });
  }

  if (b.action === "reset_staff_mfa") {
    const { user, name } = await requireStaff(req, "staff");
    const { data } = await admin.auth.admin.mfa.listFactors({ userId: b.user_id });
    for (const f of data?.factors ?? []) await admin.auth.admin.mfa.deleteFactor({ userId: b.user_id, id: f.id });
    await audit(user.id, name, "Reset two-step verification", String(b.user_id));
    return json({ ok: true });
  }

  if (b.action === "delete_member") {
    const { user, name } = await requireStaff(req, "users");
    const { data: acc } = await admin.from("accounts").select("email").eq("id", b.account_id).single();
    if (!acc) throw new HttpError(404, "Member not found.");
    const { data: isStaff } = await admin.from("staff").select("user_id").eq("user_id", b.account_id).maybeSingle();
    if (isStaff) throw new HttpError(400, "Remove this person from Staff first.");
    await admin.from("payment_methods").delete().eq("account_id", b.account_id);
    const { error } = await admin.auth.admin.deleteUser(b.account_id);
    if (error) throw new HttpError(500, error.message);
    await audit(user.id, name, "Deleted member", acc.email);
    return json({ ok: true });
  }

  if (b.action === "signout_member") {
    const { user, name } = await requireStaff(req, "users");
    await admin.from("devices").update({ revoked_at: new Date().toISOString() }).eq("account_id", b.account_id);
    await admin.from("streams").update({ stopped_by: "admin" }).eq("account_id", b.account_id).is("stopped_by", null);
    await audit(user.id, name, "Signed member out of all devices", String(b.account_id));
    return json({ ok: true });
  }

  if (b.action === "refund") {
    const { user, name } = await requireStaff(req, "payments");
    const { data: pay } = await admin.from("payments").select("*").eq("id", b.payment_id).single();
    if (!pay || pay.status !== "success") throw new HttpError(400, "Only successful payments can be refunded.");
    if (pay.channel === "credit" || pay.amount <= 0) throw new HttpError(400, "This payment was covered by credit; adjust credit instead.");
    const amount = Math.min(Number(b.amount ?? pay.amount), pay.amount);
    await paystack("/refund", { transaction: pay.reference, amount: amount * 100, merchant_note: String(b.reason ?? "Refund from MyFlix Admin") });
    await admin.from("payments").update({ status: "refunded", refunded_at: new Date().toISOString() }).eq("id", pay.id);
    if (b.end_access) await admin.from("accounts").update({ status: "cancelled", paid_until: new Date().toISOString(), cancel_at: new Date().toISOString() }).eq("id", pay.account_id);
    await audit(user.id, name, "Refunded payment", `${pay.reference} (₦${amount})`);
    return json({ ok: true });
  }

  if (b.action === "paystack_keys") {
    // The owner pastes the Paystack keys in Admin > Settings. The secret key is checked with
    // Paystack, then kept in the private schema; only its last 4 characters are ever shown again.
    const { user, name } = await requireStaff(req, "settings");
    const pub = String(b.public_key ?? "").trim();
    const sec = String(b.secret_key ?? "").trim();
    const { data: row } = await admin.from("site_settings").select("data").eq("id", 1).single();
    const data = (row?.data ?? {}) as Record<string, unknown>;
    if (b.remove) {
      await admin.rpc("set_private_secret", { p_name: "paystack_secret_key", p_value: "" });
      Object.assign(data, { paystackSecretSet: false, paystackMode: null, paystackKeyEnd: null });
    } else {
      if (pub && !/^pk_(test|live)_[A-Za-z0-9]{20,}$/.test(pub)) throw new HttpError(400, "The public key should start with pk_test_ or pk_live_.");
      if (sec) {
        if (!/^sk_(test|live)_[A-Za-z0-9]{20,}$/.test(sec)) throw new HttpError(400, "The secret key should start with sk_test_ or sk_live_.");
        if (pub && pub.split("_")[1] !== sec.split("_")[1]) throw new HttpError(400, "Use keys from the same mode: both test or both live.");
        try {
          await paystack("/bank?country=nigeria&perPage=1", undefined, "GET", sec);
        } catch {
          throw new HttpError(400, "Paystack didn't accept that secret key. Copy it again from Paystack > Settings > API Keys & Webhooks.");
        }
        await admin.rpc("set_private_secret", { p_name: "paystack_secret_key", p_value: sec });
        Object.assign(data, { paystackSecretSet: true, paystackMode: sec.split("_")[1], paystackKeyEnd: sec.slice(-4) });
      }
      if (pub) data.paystackPublicKey = pub;
    }
    await admin.from("site_settings").update({ data, updated_at: new Date().toISOString() }).eq("id", 1);
    forgetPaystackKey();
    await audit(user.id, name, b.remove ? "Removed Paystack keys" : "Updated Paystack keys", sec ? `${sec.split("_")[1]} mode, ending ${sec.slice(-4)}` : "public key");
    return json({ ok: true, mode: data.paystackMode ?? null });
  }

  if (b.action === "verify_payment") {
    // Re-checks a pending or failed payment with Paystack (e.g. a bank transfer that landed late)
    const { user, name } = await requireStaff(req, "payments");
    const { data: pay } = await admin.from("payments").select("id, reference, status").eq("id", b.payment_id).single();
    if (!pay) throw new HttpError(404, "Payment not found.");
    if (pay.status === "success") return json({ status: "success" });
    const tx = await paystack(`/transaction/verify/${encodeURIComponent(pay.reference)}`);
    const r = await applyPayment(tx);
    if (!r.ok && ["failed", "abandoned"].includes(tx.status)) await admin.from("payments").update({ status: tx.status }).eq("id", pay.id);
    await audit(user.id, name, "Checked payment with Paystack", `${pay.reference}: ${tx.status}`);
    return json({ status: r.ok ? "success" : tx.status, message: tx.gateway_response });
  }

  return fail("Unknown action.");
});
