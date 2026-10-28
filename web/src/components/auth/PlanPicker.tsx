"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { choosePlan, getAccount } from "@/lib/account";
import { annualPrice, naira, plans, type PlanId } from "@/lib/plans";
import { PrimaryButton } from "./ui";
import { StepLabel } from "./SignupShell";

export default function PlanPicker() {
  const router = useRouter();
  const [selected, setSelected] = useState<PlanId>("standard");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [annual, setAnnual] = useState(false);

  useEffect(() => {
    setMounted(true);
    const acc = getAccount();
    if (!acc) return router.replace("/signup");
    if (acc.planId) setSelected(acc.planId);
  }, [router]);

  const onNext = async () => {
    setLoading(true);
    try {
      sessionStorage.setItem("myflix.cycle", annual ? "annual" : "monthly");
    } catch {}
    const res = await choosePlan(selected);
    setLoading(false);
    if (res.ok) router.push("/signup/payment");
    else router.replace("/login");
  };

  const rows: { label: string; value: (p: (typeof plans)[number]) => string }[] = [
    { label: annual ? "Yearly price" : "Monthly price", value: (p) => (annual ? `${naira(annualPrice(p))} (${naira(Math.round(annualPrice(p) / 12))}/mo)` : naira(p.price)) },
    { label: "Video and sound quality", value: (p) => p.quality },
    { label: "Resolution", value: (p) => p.resolution },
    { label: "Supported devices", value: (p) => p.devices },
    { label: "Devices you can watch on at the same time", value: (p) => String(p.screens) },
    { label: "Download devices", value: (p) => String(p.downloads) },
  ];

  if (!mounted) return null;

  return (
    <div>
      <StepLabel step={2} />
      <h1 className="mt-1 text-3xl font-bold">Choose the plan that&apos;s right for you</h1>
      <ul className="mt-4 space-y-2 text-base">
        {["Watch all you want. No adverts.", "Recommendations just for you.", "Change or cancel your plan anytime."].map((t) => (
          <li key={t} className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-brand" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m5 12 5 5 9-10" /></svg>
            {t}
          </li>
        ))}
      </ul>

      <div className="mt-6 inline-flex rounded-full bg-neutral-100 p-1">
        {[false, true].map((a) => (
          <button key={String(a)} onClick={() => setAnnual(a)} className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${annual === a ? "bg-white shadow" : "text-neutral-500"}`}>
            {a ? "Yearly (save up to 15%)" : "Monthly"}
          </button>
        ))}
      </div>

      <div role="radiogroup" aria-label="Plans" className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {plans.map((p) => {
          const active = selected === p.id;
          return (
            <button
              key={p.id}
              role="radio"
              aria-checked={active}
              onClick={() => setSelected(p.id)}
              className={`relative rounded-2xl border-2 p-2 text-left transition ${
                active ? "border-brand shadow-lg shadow-brand/20" : "border-neutral-200 hover:border-neutral-400"
              }`}
            >
              {p.badge && (
                <span className="absolute -top-3 left-3 rounded-full bg-neutral-900 px-2 py-0.5 text-xs font-semibold text-white">
                  {p.badge}
                </span>
              )}
              <div
                className={`rounded-xl p-4 text-white ${
                  active ? "bg-gradient-to-br from-brand-bright to-[#0b4f33]" : "bg-gradient-to-br from-neutral-700 to-neutral-900"
                }`}
              >
                <p className="text-lg font-bold">{p.name}</p>
                <p className="text-sm opacity-90">{p.resolution.split(" ")[0]}</p>
                {active && (
                  <svg viewBox="0 0 24 24" className="absolute right-5 top-5 h-6 w-6" fill="white"><circle cx="12" cy="12" r="11" /><path d="m7 12 3.5 3.5L17 9" fill="none" stroke="#0d9b5f" strokeWidth="2.5" /></svg>
                )}
              </div>
              <dl className="divide-y divide-neutral-200 px-2 pt-2 text-sm">
                {rows.map((r) => (
                  <div key={r.label} className="py-2.5">
                    <dt className="text-neutral-500">{r.label}</dt>
                    <dd className="font-semibold text-neutral-800">{r.value(p)}</dd>
                  </div>
                ))}
              </dl>
            </button>
          );
        })}
      </div>

      <p className="mt-6 text-sm text-neutral-600">
        HD (720p), Full HD (1080p) and Ultra HD (4K) availability depends on your internet service and device. Not all
        content is available in every resolution. Only people who live with you may use your account.
      </p>

      <div className="mx-auto mt-8 max-w-md">
        <PrimaryButton onClick={onNext} loading={loading}>Next</PrimaryButton>
      </div>
    </div>
  );
}
