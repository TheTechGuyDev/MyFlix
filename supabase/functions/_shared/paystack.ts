import { env, HttpError, site } from "./cors.ts";
import { admin } from "./supabase.ts";
import { layout, naira, notify, sendEmail } from "./messages.ts";

const API = "https://api.paystack.co";

/**
 * Paystack secret key: entered by the owner in Admin > Settings (kept in the private schema),
 * or a PAYSTACK_SECRET_KEY function secret if one is set.
 */
let cached: { key: string; at: number } | null = null;
export async function paystackKey(): Promise<string> {
  const fromEnv = env("PAYSTACK_SECRET_KEY");
  if (fromEnv) return fromEnv;
  if (cached && Date.now() - cached.at < 60_000) return cached.key;
  const { data } = await admin.rpc("get_private_secret", { p_name: "paystack_secret_key" });
  cached = { key: (data as string | null) ?? "", at: Date.now() };
  return cached.key;
}
export const forgetPaystackKey = () => (cached = null);

export async function paystack(path: string, body?: unknown, method = body ? "POST" : "GET", secretOverride?: string) {
  const secret = secretOverride ?? (await paystackKey());
  if (!secret) throw new HttpError(503, "Payments aren't set up yet. Please try again later.");
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status === false) throw new HttpError(502, data.message ?? "The payment provider didn't respond. Please try again.");
  return data.data;
}

/** Verifies the x-paystack-signature header (HMAC SHA-512 of the raw body). */
export async function verifySignature(raw: string, signature: string | null) {
  if (!signature) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(await paystackKey()), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
  const hex = Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
  return timingSafeEqual(hex, signature);
}

export function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const addMonths = (d: Date, m: number) => {
  const x = new Date(d);
  x.setMonth(x.getMonth() + m);
  return x;
};

type Tx = {
  reference: string;
  status: string;
  amount: number;
  channel?: string;
  paid_at?: string;
  customer?: { email?: string };
  authorization?: { authorization_code?: string; last4?: string; card_type?: string; exp_month?: string; exp_year?: string; bank?: string; channel?: string; reusable?: boolean };
};

/**
 * Applies a successful Paystack transaction exactly once: marks the payment paid, saves the
 * reusable card for renewals, extends the membership, uses promo/credit and rewards referrals.
 */
export async function applyPayment(tx: Tx) {
  const { data: pay } = await admin.from("payments").select("*").eq("reference", tx.reference).single();
  if (!pay) return { ok: false, reason: "unknown reference" };
  if (pay.status === "success") return { ok: true, already: true };
  if (tx.status !== "success") {
    await admin.from("payments").update({ status: tx.status === "abandoned" ? "abandoned" : "failed", raw: tx }).eq("id", pay.id);
    return { ok: false, reason: tx.status };
  }
  // Amount check: Paystack reports kobo
  if (Math.round(tx.amount / 100) < pay.amount) {
    await admin.from("payments").update({ status: "failed", raw: tx }).eq("id", pay.id);
    return { ok: false, reason: "amount mismatch" };
  }

  // Claim the payment atomically so retries/webhooks can't apply it twice
  const { data: claimed } = await admin
    .from("payments")
    .update({ status: "success", paid_at: tx.paid_at ?? new Date().toISOString(), channel: tx.channel, last4: tx.authorization?.last4, card_type: tx.authorization?.card_type, raw: tx })
    .eq("id", pay.id)
    .eq("status", "pending")
    .select("id");
  if (!claimed?.length) return { ok: true, already: true };

  const { data: acc } = await admin.from("accounts").select("*").eq("id", pay.account_id).single();
  if (!acc) return { ok: true, orphan: true };

  // Card check: save the new card and refund the ₦50
  if (pay.kind === "card_update") {
    const a = tx.authorization;
    if (a?.authorization_code) {
      await admin.from("payment_methods").upsert({
        account_id: acc.id,
        authorization_code: a.authorization_code,
        last4: a.last4,
        card_type: a.card_type,
        exp: a.exp_month && a.exp_year ? `${a.exp_month}/${String(a.exp_year).slice(-2)}` : null,
        bank: a.bank,
        channel: a.channel,
        reusable: Boolean(a.reusable),
        updated_at: new Date().toISOString(),
      });
    }
    try {
      await paystack("/refund", { transaction: pay.reference });
      await admin.from("payments").update({ status: "refunded", refunded_at: new Date().toISOString() }).eq("id", pay.id);
    } catch (e) {
      console.error("card check refund failed", e);
    }
    return { ok: true, card: true };
  }

  const freeMonths = Number(pay.free_months ?? 0);
  const start = acc.paid_until && new Date(acc.paid_until) > new Date() ? new Date(acc.paid_until) : new Date();
  const paidUntil = addMonths(start, pay.months + freeMonths);

  await admin
    .from("accounts")
    .update({
      plan_id: pay.plan_id,
      pending_plan_id: null,
      billing_cycle: pay.cycle,
      status: "active",
      paid_until: paidUntil.toISOString(),
      cancel_at: null,
      credit: Math.max(0, (acc.credit ?? 0) - (pay.credit_used ?? 0)),
      promo: pay.promo_code ? { code: pay.promo_code } : acc.promo,
    })
    .eq("id", acc.id);

  const a = tx.authorization;
  if (a?.authorization_code) {
    await admin.from("payment_methods").upsert({
      account_id: acc.id,
      authorization_code: a.authorization_code,
      last4: a.last4,
      card_type: a.card_type,
      exp: a.exp_month && a.exp_year ? `${a.exp_month}/${String(a.exp_year).slice(-2)}` : null,
      bank: a.bank,
      channel: a.channel,
      reusable: Boolean(a.reusable),
      updated_at: new Date().toISOString(),
    });
  }

  if (pay.promo_code) {
    const { data: p } = await admin.from("promos").select("used").eq("code", pay.promo_code).single();
    if (p) await admin.from("promos").update({ used: (p.used ?? 0) + 1 }).eq("code", pay.promo_code);
  }

  // Referral: both members get a free month after the new member's first payment
  if (acc.referred_by && !acc.referral_rewarded) {
    const { data: referrer } = await admin.from("accounts").select("id, email, paid_until").eq("referral_code", acc.referred_by).single();
    if (referrer && referrer.id !== acc.id) {
      const rStart = referrer.paid_until && new Date(referrer.paid_until) > new Date() ? new Date(referrer.paid_until) : new Date();
      await admin.from("accounts").update({ paid_until: addMonths(rStart, 1).toISOString() }).eq("id", referrer.id);
      await admin.from("accounts").update({ referral_rewarded: true, paid_until: addMonths(paidUntil, 1).toISOString() }).eq("id", acc.id);
      await notify(referrer.id, "You earned a free month", "A friend joined MyFlix with your code. Enjoy a month on us.", "/account");
    }
  }

  const { data: plan } = await admin.from("plans").select("name").eq("id", pay.plan_id).single();
  await sendEmail(
    acc.email,
    "Your MyFlix receipt",
    layout(
      "Thanks for your payment",
      `We received <b>${naira(pay.amount)}</b> for the <b>${plan?.name ?? pay.plan_id}</b> plan (${pay.cycle === "annual" ? "12 months" : "1 month"}). Your membership is active until <b>${paidUntil.toDateString()}</b>.<br/><br/>Reference: ${pay.reference}`,
      { label: "View billing", url: `${site()}/account/billing/` },
    ),
    "receipt",
  );
  return { ok: true };
}
