"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { completePayment, getAccount, type PaymentMethod } from "@/lib/mock-auth";
import { annualPrice, getPlan, naira, type Plan } from "@/lib/plans";
import { checkPromo, redeemPromoUse, type PromoResult } from "@/lib/extras";
import { Alert, Field, PrimaryButton } from "./ui";
import { StepLabel } from "./SignupShell";

const methods: { id: PaymentMethod; label: string; hint: string }[] = [
  { id: "card", label: "Debit or credit card", hint: "Verve, Mastercard, Visa" },
  { id: "transfer", label: "Bank transfer", hint: "Pay from any Nigerian bank app" },
  { id: "ussd", label: "USSD", hint: "No internet banking needed" },
];

const ussdBanks = [
  { name: "GTBank", code: "*737*000*{amount}#" },
  { name: "Access Bank", code: "*901*000*{amount}#" },
  { name: "Zenith Bank", code: "*966*000*{amount}#" },
  { name: "First Bank", code: "*894*000*{amount}#" },
  { name: "UBA", code: "*919*000*{amount}#" },
];

export default function PaymentForm() {
  const router = useRouter();
  const [plan, setPlan] = useState<Plan | undefined>();
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [annual, setAnnual] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promo, setPromo] = useState<PromoResult | null>(null);

  useEffect(() => {
    const acc = getAccount();
    if (!acc) return router.replace("/signup");
    if (!acc.planId) return router.replace("/signup/plan");
    setPlan(getPlan(acc.planId));
    setEmail(acc.email);
    try {
      setAnnual(sessionStorage.getItem("myflix.cycle") === "annual");
    } catch {}
  }, [router]);

  const pay = async (last4?: string) => {
    if (!method) return;
    setError("");
    setLoading(true);
    const ok = promo?.ok ? promo : null;
    const res = await completePayment(method, last4, {
      annual,
      amount: due,
      freeMonths: ok?.freeMonths ?? 0,
      promo: ok ? { code: ok.code, label: ok.label } : undefined,
    });
    if (ok) redeemPromoUse(ok.code);
    setLoading(false);
    if (!res.ok) return setError(res.error);
    router.push("/signup/profiles");
  };

  if (!plan) return null;

  const full = annual ? annualPrice(plan) : plan.price;
  const due = promo?.ok ? promo.apply(full) : full;
  const charge: Plan = { ...plan, price: due };

  return (
    <div className="space-y-5">
      <StepLabel step={3} />
      <h1 className="text-3xl font-bold leading-tight">{method ? methods.find((m) => m.id === method)!.label : "Choose how to pay"}</h1>

      <div className="flex items-center justify-between rounded-lg bg-neutral-100 px-4 py-3">
        <div>
          <p className="font-semibold">
            {promo?.ok && <span className="mr-2 text-neutral-400 line-through">{naira(full)}</span>}
            {naira(due)} {annual ? "today, then yearly" : "today, then monthly"}
          </p>
          <p className="text-sm text-neutral-600">{plan.name} plan · {annual ? "billed yearly" : "billed monthly"}{promo?.ok ? ` · ${promo.label}` : ""}</p>
        </div>
        <Link href="/signup/plan" className="font-semibold text-brand hover:underline">
          Change
        </Link>
      </div>

      {error && <Alert>{error}</Alert>}

      <div>
        <div className="flex gap-2">
          <input
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            placeholder="Promo code"
            aria-label="Promo code"
            className="h-11 flex-1 rounded border border-neutral-400 px-3 text-base uppercase outline-none focus:ring-2 focus:ring-neutral-900"
          />
          <button
            type="button"
            onClick={() => setPromo(checkPromo(promoCode, plan.id))}
            className="h-11 rounded border border-neutral-900 px-4 font-semibold hover:bg-neutral-900 hover:text-white"
          >
            Apply
          </button>
        </div>
        {promo && !promo.ok && <p className="mt-1 text-sm text-danger">{promo.error}</p>}
        {promo?.ok && <p className="mt-1 text-sm font-semibold text-brand">Code {promo.code} applied: {promo.label}</p>}
      </div>

      {!method && (
        <>
          <p className="text-lg">Your payment is encrypted and you can change how you pay anytime.</p>
          <p className="flex items-center gap-2 text-sm text-neutral-600">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 1 1 6 0v3z" /></svg>
            Secured by Paystack
          </p>
          <div className="space-y-3">
            {methods.map((m) => (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className="flex w-full items-center justify-between rounded-lg border-2 border-neutral-300 px-4 py-4 text-left transition hover:border-neutral-500"
              >
                <span>
                  <span className="block text-lg font-semibold">{m.label}</span>
                  <span className="block text-sm text-neutral-600">{m.hint}</span>
                </span>
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-neutral-500" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 5 7 7-7 7" /></svg>
              </button>
            ))}
          </div>
        </>
      )}

      {method === "card" && <CardForm plan={charge} loading={loading} onPay={pay} />}
      {method === "transfer" && <TransferPanel plan={charge} email={email} loading={loading} onPay={() => pay()} />}
      {method === "ussd" && <UssdPanel plan={charge} loading={loading} onPay={() => pay()} />}

      {method && (
        <button onClick={() => setMethod(null)} className="text-sm font-semibold text-neutral-600 hover:underline">
          ← Choose a different payment method
        </button>
      )}

      <p className="text-xs text-neutral-500">
        Demo mode: no real charge is made. Live Paystack payments will be connected with the backend.
      </p>
    </div>
  );
}

function CardForm({ plan, loading, onPay }: { plan: Plan; loading: boolean; onPay: (last4: string) => void }) {
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const digits = number.replace(/\D/g, "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (digits.length < 16 || digits.length > 19) errs.number = "Please enter a valid card number.";
    const [mm, yy] = expiry.split("/").map((s) => parseInt(s, 10));
    const now = new Date();
    const expired = !mm || !yy || mm < 1 || mm > 12 || new Date(2000 + yy, mm) <= now;
    if (expired) errs.expiry = "Please enter a valid expiry date.";
    if (!/^\d{3,4}$/.test(cvv)) errs.cvv = "Please enter a valid CVV.";
    if (!name.trim()) errs.name = "Please enter the name on the card.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onPay(digits.slice(-4));
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <Field
        label="Card number"
        inputMode="numeric"
        autoComplete="cc-number"
        value={number}
        onChange={(e) => setNumber(e.target.value.replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim())}
        error={errors.number}
      />
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Expiry (MM/YY)"
          inputMode="numeric"
          autoComplete="cc-exp"
          value={expiry}
          onChange={(e) => {
            const d = e.target.value.replace(/\D/g, "").slice(0, 4);
            setExpiry(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
          }}
          error={errors.expiry}
        />
        <Field
          label="CVV"
          inputMode="numeric"
          autoComplete="cc-csc"
          value={cvv}
          onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
          error={errors.cvv}
        />
      </div>
      <Field label="Name on card" autoComplete="cc-name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
      <Terms plan={plan} />
      <PrimaryButton type="submit" loading={loading}>Start Membership</PrimaryButton>
    </form>
  );
}

function TransferPanel({ plan, email, loading, onPay }: { plan: Plan; email: string; loading: boolean; onPay: () => void }) {
  const [ref] = useState(() => `MYF-${email.slice(0, 3).toUpperCase()}${Date.now().toString().slice(-5)}`);
  const [copied, setCopied] = useState("");
  const copy = (v: string) => {
    navigator.clipboard?.writeText(v).catch(() => {});
    setCopied(v);
    setTimeout(() => setCopied(""), 1500);
  };
  const rows = [
    { label: "Bank", value: "Wema Bank (Demo)" },
    { label: "Account number", value: "0123456789", copy: true },
    { label: "Account name", value: "MyFlix Checkout" },
    { label: "Amount", value: naira(plan.price), copy: true },
    { label: "Reference", value: ref, copy: true },
  ];
  return (
    <div className="space-y-4">
      <p className="text-lg">Transfer the exact amount to this account. It expires in 30 minutes.</p>
      <dl className="divide-y divide-neutral-200 rounded-lg border border-neutral-300">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between px-4 py-3">
            <dt className="text-sm text-neutral-600">{r.label}</dt>
            <dd className="flex items-center gap-2 font-semibold">
              {r.value}
              {r.copy && (
                <button type="button" onClick={() => copy(r.value)} className="text-xs font-semibold text-brand">
                  {copied === r.value ? "Copied" : "Copy"}
                </button>
              )}
            </dd>
          </div>
        ))}
      </dl>
      <Terms plan={plan} />
      <PrimaryButton onClick={onPay} loading={loading}>I&apos;ve sent the money</PrimaryButton>
    </div>
  );
}

function UssdPanel({ plan, loading, onPay }: { plan: Plan; loading: boolean; onPay: () => void }) {
  const [bank, setBank] = useState(ussdBanks[0].name);
  const code = ussdBanks.find((b) => b.name === bank)!.code.replace("{amount}", String(plan.price));
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm text-neutral-600">Select your bank</span>
        <select
          value={bank}
          onChange={(e) => setBank(e.target.value)}
          className="h-14 w-full rounded border border-neutral-400 bg-white px-4 text-base outline-none focus:ring-2 focus:ring-neutral-900"
        >
          {ussdBanks.map((b) => (
            <option key={b.name}>{b.name}</option>
          ))}
        </select>
      </label>
      <div className="rounded-lg bg-neutral-100 p-5 text-center">
        <p className="text-sm text-neutral-600">Dial this code on the phone linked to your account</p>
        <a href={`tel:${encodeURIComponent(code)}`} className="mt-2 block text-3xl font-bold tracking-wide">
          {code}
        </a>
      </div>
      <Terms plan={plan} />
      <PrimaryButton onClick={onPay} loading={loading}>I&apos;ve completed payment</PrimaryButton>
    </div>
  );
}

function Terms({ plan }: { plan: Plan }) {
  return (
    <p className="text-sm text-neutral-600">
      By continuing, you agree to pay {naira(plan.price)} today. Your membership then renews automatically at the full plan price until you
      cancel. Cancel anytime from your Account page to avoid future charges.
    </p>
  );
}
