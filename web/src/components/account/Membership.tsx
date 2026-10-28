"use client";

import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { Alert, PrimaryButton } from "@/components/auth/ui";
import PaymentForm from "@/components/auth/PaymentForm";
import { billingHistory, cancelMembership, changePlanNow, restartMembership, updatePaymentMethod } from "@/lib/account";
import { getPlan, naira, plans, type PlanId } from "@/lib/plans";
import { Card, PageTitle, fmtDate, useAccountCtx } from "./AccountShell";
import { methodLabel } from "./Overview";

/* ---------------- Change plan ---------------- */
export function ChangePlan() {
  const { account, refresh, toast } = useAccountCtx();
  const router = useRouter();
  const [sel, setSel] = useState<PlanId>(account.planId ?? "standard");
  const [loading, setLoading] = useState(false);
  const current = getPlan(account.planId);
  const chosen = getPlan(sel)!;
  const upgrade = current && chosen.price > current.price;

  const confirm = async () => {
    setLoading(true);
    const r = await changePlanNow(sel);
    setLoading(false);
    if (!r.ok) return toast(r.error);
    refresh();
    if (r.data.when === "payment") return router.push("/account/payment?pay=1");
    toast(r.data.when === "now" ? `You're now on the ${chosen.name} plan.` : `${chosen.name} starts on ${fmtDate(r.data.at)}.`);
    router.push("/account");
  };

  return (
    <div>
      <PageTitle title="Change plan" back="/account" sub="Upgrades start right away. Downgrades start at your next renewal." />
      <div className="grid gap-3 sm:grid-cols-2">
        {plans.map((p) => {
          const on = sel === p.id;
          return (
            <button key={p.id} onClick={() => setSel(p.id)} className={`rounded-xl border-2 bg-white p-5 text-left transition ${on ? "border-brand shadow-md" : "border-transparent shadow-sm hover:border-neutral-300"}`}>
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold">{p.name}</span>
                {account.planId === p.id && <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-xs font-semibold text-white">Current plan</span>}
              </div>
              <p className="mt-1 text-2xl font-bold">{naira(p.price)}<span className="text-sm font-normal text-neutral-500">/month</span></p>
              <ul className="mt-3 space-y-1 text-sm text-neutral-600">
                <li>{p.resolution}</li>
                <li>Watch on {p.screens} device{p.screens > 1 ? "s" : ""} at a time</li>
                <li>Download on {p.downloads} device{p.downloads > 1 ? "s" : ""}</li>
                <li>{p.devices}</li>
              </ul>
            </button>
          );
        })}
      </div>
      {sel !== account.planId && (
        <Card className="mt-6">
          <p className="font-semibold">
            {upgrade ? "Upgrade" : "Change"} to {chosen.name}: {naira(chosen.price)}/month
          </p>
          <p className="mt-1 text-sm text-neutral-600">
            {upgrade
              ? "You'll get the new features immediately. The difference is added to your next bill."
              : `Your new price starts on ${fmtDate(account.payment?.renewsAt)}.`}
          </p>
          <PrimaryButton onClick={confirm} loading={loading} className="mt-4 !h-12 !text-base sm:!w-56">Confirm change</PrimaryButton>
        </Card>
      )}
    </div>
  );
}

/* ---------------- Payment method ---------------- */
export function ManagePayment() {
  const { account } = useAccountCtx();
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const p = account.payment;
  const due = !account.hasAccess || account.status === "past_due";
  const [payNow, setPayNow] = useState(() => due || (typeof window !== "undefined" && /[?&](pay|reference|trxref)=/.test(location.search)));

  const updateCard = async () => {
    setErr("");
    setLoading(true);
    const r = await updatePaymentMethod();
    setLoading(false);
    if (!r.ok) return setErr(r.error);
    if (r.data.url) window.location.href = r.data.url;
  };

  return (
    <div className="space-y-6">
      <PageTitle title="Payment method" back="/account" sub="Payments are processed securely by Paystack." />
      {due && <Alert>{account.status === "past_due" ? "Your last payment didn't go through. Pay now to keep watching." : "Your membership isn't active. Pay to start watching."}</Alert>}
      <Card title="Saved for renewals">
        {p?.last4 ? (
          <p className="text-lg font-semibold">{(p.cardType ?? "Card").trim()} ending {p.last4}</p>
        ) : (
          <p className="text-neutral-600">{p ? methodLabel(p.method) : "No saved card."} Renewals by bank transfer or USSD are paid from the reminder we send before each renewal.</p>
        )}
        {p && !p.reusable && p.last4 && <p className="mt-1 text-sm text-neutral-500">This card can&apos;t be charged automatically. We&apos;ll remind you before each renewal.</p>}
        {err && <p className="mt-3 text-sm text-danger">{err}</p>}
        <div className="mt-5 flex flex-wrap gap-3">
          <PrimaryButton onClick={updateCard} loading={loading} className="!h-12 !w-auto !px-6 !text-base">{p?.last4 ? "Change card" : "Add a card"}</PrimaryButton>
          {!payNow && <button onClick={() => setPayNow(true)} className="h-12 rounded border border-neutral-400 px-6 font-semibold hover:bg-neutral-100">Pay now</button>}
        </div>
        <p className="mt-3 text-xs text-neutral-500">To check a new card, Paystack charges ₦50 and we refund it straight away.</p>
      </Card>
      {payNow && (
        <Card title={due ? "Pay to continue" : "Pay now"}>
          <Suspense>
            <PaymentForm returnTo="/account/payment/" next="/account" />
          </Suspense>
        </Card>
      )}
    </div>
  );
}

/* ---------------- Billing history ---------------- */
export function BillingHistory() {
  const { account } = useAccountCtx();
  const rows = billingHistory(account);
  return (
    <div>
      <PageTitle title="Billing history" back="/account" sub={account.payment ? `Next payment: ${fmtDate(account.payment.renewsAt)}` : undefined} />
      <Card>
        {rows.length === 0 ? (
          <p className="text-neutral-600">No payments yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-neutral-500">
                <tr>
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">Description</th>
                  <th className="pb-3 font-medium">Payment</th>
                  <th className="pb-3 text-right font-medium">Total</th>
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-neutral-200">
                    <td className="py-3">{fmtDate(r.date)}</td>
                    <td className="py-3">MyFlix {getPlan(r.planId)?.name}{r.status === "Refunded" ? " (refunded)" : ""}</td>
                    <td className="py-3">{methodLabel(r.method, r.last4)}</td>
                    <td className="py-3 text-right font-semibold">{naira(r.amount)}</td>
                    <td className="py-3 text-right">
                      <button onClick={() => printReceipt(r, account.email)} className="font-semibold text-brand hover:underline">Receipt</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------------- Cancel / restart ---------------- */
export function CancelMembership() {
  const { account, refresh, toast } = useAccountCtx();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const cancelled = Boolean(account.cancelAt);

  const act = async () => {
    setLoading(true);
    const r = cancelled ? await restartMembership() : await cancelMembership();
    setLoading(false);
    if (!r.ok) return toast(r.error);
    refresh();
    toast(cancelled ? "Welcome back! Your membership has been restarted." : "Your membership has been cancelled.");
    router.push("/account");
  };

  return (
    <div>
      <PageTitle title={cancelled ? "Restart membership" : "Cancel membership"} back="/account" />
      <Card>
        {cancelled ? (
          <>
            <p className="text-lg">Your membership ends on <b>{fmtDate(account.cancelAt)}</b>.</p>
            <p className="mt-2 text-neutral-600">Restart now to keep watching without interruption. Your profiles, My List and viewing history are all still here.</p>
            <PrimaryButton onClick={act} loading={loading} className="mt-5 !h-12 !text-base sm:!w-64">Restart Membership</PrimaryButton>
          </>
        ) : (
          <>
            <ul className="space-y-3 text-neutral-700">
              <li>• Your cancellation takes effect at the end of your billing period on <b>{fmtDate(account.payment?.renewsAt)}</b>.</li>
              <li>• You can keep watching until then.</li>
              <li>• Restart anytime. Your profiles, My List and history are kept for 10 months.</li>
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={act} disabled={loading} className="h-12 rounded bg-danger px-6 font-semibold text-white hover:opacity-90 disabled:opacity-60">
                {loading ? "Cancelling..." : "Finish Cancellation"}
              </button>
              <button onClick={() => router.push("/account")} className="h-12 rounded border border-neutral-400 px-6 font-semibold hover:bg-neutral-100">Go Back</button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

/** Opens a printable receipt (save as PDF from the print dialog). */
function printReceipt(r: ReturnType<typeof billingHistory>[number], email: string) {
  const w = window.open("", "_blank", "width=600,height=700");
  if (!w) return;
  w.document.write(`<html><head><title>MyFlix receipt ${r.id}</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#111}h1{margin:0 0 4px}td{padding:6px 0}.t{border-top:1px solid #ccc;font-weight:bold}</style></head><body>
<h1>MY<span style="color:#0e9f62">FLIX</span></h1><p>Receipt ${r.id}</p>
<table width="100%"><tr><td>Date</td><td align="right">${new Date(r.date).toLocaleDateString("en-NG", { dateStyle: "long" })}</td></tr>
<tr><td>Billed to</td><td align="right">${email}</td></tr>
<tr><td>Description</td><td align="right">MyFlix ${getPlan(r.planId)?.name ?? r.planId} membership</td></tr>
<tr><td>Payment</td><td align="right">${r.method}${r.last4 ? " ending " + r.last4 : ""}</td></tr>
<tr class="t"><td class="t">Total</td><td class="t" align="right">₦${r.amount.toLocaleString("en-NG")}${r.status === "Refunded" ? " (refunded)" : ""}</td></tr></table>
<p style="margin-top:32px;font-size:12px;color:#666">MyFlix Nigeria · help@myflix.ng</p><script>print()</script></body></html>`);
  w.document.close();
}
