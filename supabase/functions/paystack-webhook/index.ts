// Paystack webhook: the source of truth for payments (set the URL in Paystack > Settings > API Keys & Webhooks).
import { json } from "../_shared/cors.ts";
import { admin } from "../_shared/supabase.ts";
import { applyPayment, verifySignature } from "../_shared/paystack.ts";
import { layout, naira, sendEmail } from "../_shared/messages.ts";

Deno.serve(async (req) => {
  const raw = await req.text();
  if (!(await verifySignature(raw, req.headers.get("x-paystack-signature")))) return new Response("bad signature", { status: 401 });
  const event = JSON.parse(raw);
  const d = event.data ?? {};

  if (event.event === "charge.success") await applyPayment(d);

  if (event.event === "refund.processed" || event.event === "refund.processing") {
    const ref = d.transaction_reference ?? d.transaction?.reference;
    if (ref) {
      const { data: pay } = await admin.from("payments").update({ status: "refunded", refunded_at: new Date().toISOString() }).eq("reference", ref).select("email, amount").single();
      if (pay && event.event === "refund.processed") await sendEmail(pay.email, "Your MyFlix refund", layout("Refund processed", `We've refunded ${naira(pay.amount)} to your original payment method. It can take 3 to 10 working days to show.`), "refund");
    }
  }
  return json({ received: true });
});
