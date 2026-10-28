"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getAccount, quote, startPayment, verifyPayment, type Quote } from "@/lib/account";
import { getPlan, naira, type Plan } from "@/lib/plans";
import { Alert, Field, PrimaryButton, Spinner } from "./ui";
import { StepLabel } from "./SignupShell";

/**
 * Checkout: the price comes from the server (plan, yearly discount, promo, credit) and payment
 * happens on Paystack's secure page (card, bank transfer or USSD). Paystack sends the member back
 * here with ?reference=..., which we verify on the server before unlocking the account.
 */
export default function PaymentForm({ returnTo = "/signup/payment/", next = "/signup/profiles" }: { returnTo?: string; next?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const reference = params.get("reference") ?? params.get("trxref");
  const [plan, setPlan] = useState<Plan | undefined>();
  const [annual, setAnnual] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [applied, setApplied] = useState("");
  const [q, setQ] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(Boolean(reference));
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const acc = getAccount();
    if (!acc) return router.replace("/signup");
    if (!acc.planId) return router.replace("/signup/plan");
    if (acc.hasAccess && !reference && returnTo.startsWith("/signup")) return router.replace(next);
    setPlan(getPlan(acc.pendingPlanId ?? acc.planId));
    try {
      setAnnual(sessionStorage.getItem("myflix.cycle") === "annual" || acc.billingCycle === "annual");
    } catch {
      /* ignore */
    }
  }, [router, reference, next, returnTo]);

  const refreshQuote = useCallback(async () => {
    if (!plan) return;
    const r = await quote(plan.id, annual ? "annual" : "monthly", applied || undefined);
    setQ(r);
    if (applied && r?.promo_error) {
      setError(r.promo_error);
      setApplied("");
    }
  }, [plan, annual, applied]);

  useEffect(() => {
    void refreshQuote();
  }, [refreshQuote]);

  // Back from Paystack: confirm on the server
  const check = useCallback(async () => {
    if (!reference) return;
    setChecking(true);
    setError("");
    const r = await verifyPayment(reference);
    setChecking(false);
    if (r.ok) return router.replace(next);
    setPending(true);
    setError(r.error);
  }, [reference, router, next]);

  useEffect(() => {
    void check();
  }, [check]);

  const pay = async () => {
    if (!plan) return;
    setError("");
    setLoading(true);
    const r = await startPayment({ plan: plan.id, cycle: annual ? "annual" : "monthly", promo: applied || undefined, returnTo });
    if (!r.ok) {
      setLoading(false);
      return setError(r.error);
    }
    if (r.data.done) return router.replace(next);
    window.location.href = r.data.url!;
  };

  if (checking) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <Spinner className="h-10 w-10 text-brand" />
        <p className="text-lg font-semibold">Confirming your payment…</p>
        <p className="text-neutral-500">This takes a few seconds. Please don&apos;t close this page.</p>
      </div>
    );
  }

  if (!plan) return null;

  return (
    <div className="space-y-5">
      {returnTo.startsWith("/signup") && <StepLabel step={3} />}
      <h1 className="text-3xl font-bold leading-tight">{pending ? "Payment not confirmed yet" : "Set up your payment"}</h1>

      {pending && (
        <Alert>
          {error || "We haven't received confirmation from your bank yet."} Bank transfers can take a few minutes.{" "}
          <button onClick={check} className="font-semibold underline">Check again</button>
        </Alert>
      )}

      <div className="inline-flex rounded-full bg-neutral-100 p-1">
        {[false, true].map((a) => (
          <button key={String(a)} onClick={() => setAnnual(a)} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${annual === a ? "bg-white shadow" : "text-neutral-500"}`}>
            {a ? `Yearly (save ${plan.annualDiscount ?? 15}%)` : "Monthly"}
          </button>
        ))}
      </div>

      <div className="rounded-lg bg-neutral-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">{plan.name} plan</p>
            <p className="text-sm text-neutral-500">{plan.resolution} · {plan.screens} screen{plan.screens > 1 ? "s" : ""} at a time</p>
          </div>
          <Link href="/signup/plan" className="font-semibold text-brand hover:underline">Change</Link>
        </div>
        {q?.ok && (
          <dl className="mt-3 space-y-1 border-t border-neutral-200 pt-3 text-sm">
            <div className="flex justify-between"><dt>{annual ? "12 months" : "1 month"}</dt><dd>{naira(q.base)}</dd></div>
            {q.discount > 0 && <div className="flex justify-between text-brand"><dt>{q.promo?.label ?? "Promo"}</dt><dd>-{naira(q.discount)}</dd></div>}
            {q.free_months > 0 && <div className="flex justify-between text-brand"><dt>{q.promo?.label ?? "Promo"}</dt><dd>+{q.free_months} free month{q.free_months > 1 ? "s" : ""}</dd></div>}
            {q.credit_used > 0 && <div className="flex justify-between text-brand"><dt>Account credit</dt><dd>-{naira(q.credit_used)}</dd></div>}
            <div className="flex justify-between pt-1 text-base font-bold"><dt>Due today</dt><dd>{naira(q.amount)}</dd></div>
          </dl>
        )}
      </div>

      <div className="flex gap-2">
        <Field label="Promo code (optional)" aria-label="Promo code" className="flex-1" value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())} />
        <button
          type="button"
          onClick={() => {
            setError("");
            setApplied(promoCode.trim());
          }}
          disabled={!promoCode.trim()}
          className="h-14 rounded border border-neutral-400 px-5 font-semibold disabled:opacity-50"
        >
          Apply
        </button>
      </div>
      {!pending && error && <Alert>{error}</Alert>}

      <PrimaryButton onClick={pay} loading={loading} disabled={!q?.ok}>
        {q?.ok && q.amount <= 0 ? "Start membership" : `Pay ${q?.ok ? naira(q.amount) : ""} securely`}
      </PrimaryButton>
      <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
        Card, bank transfer or USSD on Paystack&apos;s secure page. {annual ? "Renews yearly" : "Renews monthly"} until you cancel. Cancel anytime in Account.
      </div>
      <p className="text-xs text-neutral-500">
        By paying you agree to our <Link href="/terms" className="underline">Terms of Use</Link>. Your card details go straight to Paystack; MyFlix never sees or stores them.
      </p>
    </div>
  );
}
