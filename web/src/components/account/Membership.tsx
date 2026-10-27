"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, PrimaryButton } from "@/components/auth/ui";
import { billingHistory, cancelMembership, changePlanNow, restartMembership, updatePaymentMethod, type PaymentMethod } from "@/lib/mock-auth";
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
    await changePlanNow(sel);
    setLoading(false);
    refresh();
    toast(`You're now on the ${chosen.name} plan.`);
    router.push("/account");
  };

  return (
    <div>
      <PageTitle title="Change plan" back="/account" sub="Switch anytime. Changes take effect right away." />
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
  const { account, refresh, toast } = useAccountCtx();
  const router = useRouter();
  const [method, setMethod] = useState<PaymentMethod>(account.payment?.method ?? "card");
  const [num, setNum] = useState("");
  const [exp, setExp] = useState("");
  const [cvv, setCvv] = useState("");
  const [err, setErr] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const save = async () => {
    const digits = num.replace(/\D/g, "");
    if (method === "card") {
      const e: Record<string, string> = {};
      if (digits.length < 16) e.num = "Please enter a valid card number.";
      if (!/^\d{2}\/\d{2}$/.test(exp)) e.exp = "Use MM/YY.";
      if (!/^\d{3,4}$/.test(cvv)) e.cvv = "Please enter a valid CVV.";
      setErr(e);
      if (Object.keys(e).length) return;
    }
    setLoading(true);
    await updatePaymentMethod(method, method === "card" ? digits.slice(-4) : undefined);
    setLoading(false);
    refresh();
    toast("Payment method updated.");
    router.push("/account");
  };

  return (
    <div>
      <PageTitle title="Manage payment method" back="/account" sub={`Current: ${methodLabel(account.payment?.method, account.payment?.last4)}`} />
      <Card>
        <div className="grid grid-cols-3 gap-2">
          {(["card", "transfer", "ussd"] as PaymentMethod[]).map((m) => (
            <button key={m} onClick={() => setMethod(m)} className={`rounded-lg border-2 px-3 py-3 text-sm font-semibold ${method === m ? "border-brand bg-brand/5" : "border-neutral-200 hover:border-neutral-400"}`}>
              {m === "card" ? "Card" : m === "transfer" ? "Bank transfer" : "USSD"}
            </button>
          ))}
        </div>
        <div className="mt-5 space-y-3">
          {method === "card" ? (
            <>
              <Field label="Card number" inputMode="numeric" value={num} onChange={(e) => setNum(e.target.value.replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim())} error={err.num} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Expiry (MM/YY)" inputMode="numeric" value={exp} onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 4); setExp(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d); }} error={err.exp} />
                <Field label="CVV" inputMode="numeric" value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} error={err.cvv} />
              </div>
            </>
          ) : (
            <p className="rounded-lg bg-neutral-100 p-4 text-sm text-neutral-700">
              {method === "transfer"
                ? "Each month we'll send you a one-time account number to transfer your subscription fee to."
                : "Each month we'll send you a USSD code to dial from the phone linked to your bank account."}
            </p>
          )}
        </div>
        <PrimaryButton onClick={save} loading={loading} className="mt-5 !h-12 !text-base sm:!w-56">Save</PrimaryButton>
        <p className="mt-3 text-xs text-neutral-500">Demo mode: no card details are stored. Live payments connect with the backend.</p>
      </Card>
    </div>
  );
}

/* ---------------- Billing history ---------------- */
export function BillingHistory() {
  const { account, toast } = useAccountCtx();
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
                    <td className="py-3">MyFlix {getPlan(r.planId)?.name} (monthly)</td>
                    <td className="py-3">{methodLabel(r.method, r.last4)}</td>
                    <td className="py-3 text-right font-semibold">{naira(r.amount)}</td>
                    <td className="py-3 text-right">
                      <button onClick={() => toast(`Receipt ${r.id} will be emailed to ${account.email}.`)} className="font-semibold text-brand hover:underline">Receipt</button>
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
    if (cancelled) await restartMembership();
    else await cancelMembership();
    setLoading(false);
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
