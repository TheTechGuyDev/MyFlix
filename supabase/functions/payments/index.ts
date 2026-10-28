// Starts and confirms Paystack payments. Prices are always calculated on the server (price_quote).
import { fail, HttpError, json, serve, site } from "../_shared/cors.ts";
import { admin, requireUser, settings } from "../_shared/supabase.ts";
import { applyPayment, paystack } from "../_shared/paystack.ts";

serve(async (req) => {
  const user = await requireUser(req);
  const body = await req.json().catch(() => ({}));

  if (body.action === "init") {
    const plan = String(body.plan ?? "");
    const cycle = body.cycle === "annual" ? "annual" : "monthly";
    const { data: acc } = await admin.from("accounts").select("*").eq("id", user.id).single();
    if (!acc) throw new HttpError(404, "Account not found.");
    if (acc.status === "suspended") throw new HttpError(403, "This account is suspended. Contact MyFlix support.");

    const { data: q, error } = await admin.rpc("price_quote", { p_account: user.id, p_plan: plan, p_cycle: cycle, p_promo: body.promo ?? null });
    if (error || !q?.ok) throw new HttpError(400, q?.error ?? "We couldn't price that plan.");
    if (q.promo_error && body.promo) throw new HttpError(400, q.promo_error);

    const reference = `MYF-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const kind = acc.plan_id && acc.paid_until && new Date(acc.paid_until) > new Date() ? "renewal" : "subscription";
    await admin.from("payments").insert({
      account_id: user.id,
      email: acc.email,
      reference,
      kind,
      amount: q.amount,
      plan_id: plan,
      cycle,
      months: q.months,
      free_months: q.free_months,
      promo_code: q.promo?.code ?? null,
      credit_used: q.credit_used,
    });

    // Fully covered by credit or promo: no card needed
    if (q.amount <= 0) {
      await applyPayment({ reference, status: "success", amount: 0, channel: "credit" });
      return json({ done: true, reference });
    }

    const cfg = await settings();
    const callback = String(body.callback_url ?? `${site()}/signup/payment/`);
    const tx = await paystack("/transaction/initialize", {
      email: acc.email,
      amount: q.amount * 100,
      currency: "NGN",
      reference,
      callback_url: callback,
      channels: ["card", ...(cfg.transferEnabled === false ? [] : ["bank_transfer", "bank"]), ...(cfg.ussdEnabled === false ? [] : ["ussd"])],
      metadata: { account_id: user.id, plan, cycle, custom_fields: [{ display_name: "Plan", variable_name: "plan", value: `${plan} (${cycle})` }] },
    });
    return json({ authorization_url: tx.authorization_url, access_code: tx.access_code, reference, amount: q.amount });
  }

  if (body.action === "card") {
    // Change the saved card: Paystack checks it with a ₦50 charge that we refund right away
    const { data: acc } = await admin.from("accounts").select("email").eq("id", user.id).single();
    if (!acc) throw new HttpError(404, "Account not found.");
    const reference = `MYF-C-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    await admin.from("payments").insert({ account_id: user.id, email: acc.email, reference, kind: "card_update", amount: 50, months: 0 });
    const tx = await paystack("/transaction/initialize", {
      email: acc.email,
      amount: 5000,
      currency: "NGN",
      reference,
      callback_url: String(body.callback_url ?? `${site()}/account/payment/`),
      channels: ["card"],
      metadata: { account_id: user.id, purpose: "card_update" },
    });
    return json({ authorization_url: tx.authorization_url, reference });
  }

  if (body.action === "verify") {
    const reference = String(body.reference ?? "");
    const { data: pay } = await admin.from("payments").select("account_id, status").eq("reference", reference).single();
    if (!pay || pay.account_id !== user.id) throw new HttpError(404, "Payment not found.");
    if (pay.status === "success") return json({ status: "success" });
    const tx = await paystack(`/transaction/verify/${encodeURIComponent(reference)}`);
    const r = await applyPayment(tx);
    return json({ status: r.ok ? "success" : tx.status, message: tx.gateway_response });
  }

  return fail("Unknown action.");
});
