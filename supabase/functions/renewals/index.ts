// Daily renewal run (called by the scheduled GitHub workflow with CRON_SECRET).
// Charges saved cards for memberships ending in the next 24 hours; marks lapsed ones past due.
import { env, json } from "../_shared/cors.ts";
import { admin } from "../_shared/supabase.ts";
import { applyPayment, paystack, timingSafeEqual } from "../_shared/paystack.ts";
import { layout, naira, notify, sendEmail } from "../_shared/messages.ts";
import { site } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const secret = env("CRON_SECRET");
  if (!secret || !timingSafeEqual(req.headers.get("x-cron-secret") ?? "", secret)) return new Response("forbidden", { status: 403 });
  const soon = new Date(Date.now() + 864e5).toISOString();
  const { data: due } = await admin
    .from("accounts")
    .select("id, email, plan_id, pending_plan_id, billing_cycle, paid_until, credit")
    .in("status", ["active", "past_due"])
    .is("cancel_at", null)
    .lte("paid_until", soon)
    .limit(200);

  const results: Record<string, string> = {};
  for (const acc of due ?? []) {
    const plan = acc.pending_plan_id ?? acc.plan_id;
    const { data: method } = await admin.from("payment_methods").select("authorization_code, reusable").eq("account_id", acc.id).single();
    const { data: q } = await admin.rpc("price_quote", { p_account: acc.id, p_plan: plan, p_cycle: acc.billing_cycle, p_promo: null });
    if (!q?.ok) continue;
    const reference = `MYF-R-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    await admin.from("payments").insert({ account_id: acc.id, email: acc.email, reference, kind: "renewal", amount: q.amount, plan_id: plan, cycle: acc.billing_cycle, months: q.months, credit_used: q.credit_used });

    if (q.amount <= 0) {
      await applyPayment({ reference, status: "success", amount: 0, channel: "credit" });
      results[acc.email] = "credit";
      continue;
    }
    if (!method?.reusable) {
      await markDue(acc, q.amount, "We couldn't renew automatically because there's no saved card. Pay now to keep watching.");
      results[acc.email] = "no card";
      continue;
    }
    try {
      const tx = await paystack("/transaction/charge_authorization", { email: acc.email, amount: q.amount * 100, authorization_code: method.authorization_code, reference });
      const r = await applyPayment(tx);
      results[acc.email] = r.ok ? "renewed" : tx.status;
      if (!r.ok) await markDue(acc, q.amount, "Your card was declined. Update your payment method to keep watching.");
    } catch {
      await markDue(acc, q.amount, "We couldn't charge your card. Update your payment method to keep watching.");
      results[acc.email] = "failed";
    }
  }

  // Memberships that ended
  await admin.from("accounts").update({ status: "cancelled" }).eq("status", "active").not("cancel_at", "is", null).lte("paid_until", new Date().toISOString());
  return json({ processed: Object.keys(results).length, results });
});

async function markDue(acc: { id: string; email: string; paid_until: string | null }, amount: number, why: string) {
  if (acc.paid_until && new Date(acc.paid_until) < new Date()) await admin.from("accounts").update({ status: "past_due" }).eq("id", acc.id);
  await notify(acc.id, "Payment needed", why, "/account/payment");
  await sendEmail(acc.email, "Action needed: your MyFlix payment", layout("We couldn't renew your membership", `${why}<br/><br/>Amount due: <b>${naira(amount)}</b>`, { label: "Update payment", url: `${site()}/account/payment/` }), "billing");
}
