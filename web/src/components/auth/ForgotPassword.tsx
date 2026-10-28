"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { requestPasswordReset, verifyResetCode } from "@/lib/account";
import { isPhoneLike, normalPhone } from "@/lib/messaging";
import { siteSettings } from "@/lib/site-settings";
import { Alert, Field, PrimaryButton, validateEmail } from "./ui";

export default function ForgotPassword() {
  const router = useRouter();
  const sms = siteSettings().smsEnabled;
  const [via, setVia] = useState<"email" | "sms">("email");
  const [value, setValue] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = via === "email" ? validateEmail(value) : isPhoneLike(value) && normalPhone(value) ? "" : "Enter a valid Nigerian phone number.";
    setError(err);
    if (err) return;
    setLoading(true);
    const r = await requestPasswordReset(value);
    setLoading(false);
    if (!r.ok) return setError(r.error);
    setSent(true);
  };

  const useCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code.");
    setLoading(true);
    const r = await verifyResetCode(value, code);
    setLoading(false);
    if (!r.ok) return setError(r.error);
    router.push("/login/reset");
  };

  return (
    <div className="w-full bg-black/75 px-5 py-10 sm:max-w-md sm:rounded-lg sm:px-12 sm:py-12">
      {sent ? (
        <form onSubmit={useCode} noValidate className="space-y-4">
          <h1 className="text-3xl font-bold">{via === "email" ? "Check your email" : "Check your phone"}</h1>
          <p className="text-muted">
            If an account uses <b className="text-white">{value}</b>, we&apos;ve sent {via === "email" ? "a reset link and a 6-digit code" : "a 6-digit code"}. Tap the link, or enter the code here.
          </p>
          {error && <Alert tone="dark">{error}</Alert>}
          <Field tone="dark" label="6-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          <PrimaryButton type="submit" loading={loading} className="!h-12 !text-base">Continue</PrimaryButton>
          <button type="button" onClick={() => { setSent(false); setCode(""); setError(""); }} className="block font-semibold text-white hover:underline">Didn&apos;t get it? Try again</button>
          <Link href="/login" className="inline-block text-white hover:underline">Back to Sign In</Link>
        </form>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          <h1 className="text-3xl font-bold">Forgot your password?</h1>
          {sms && (
            <div className="flex gap-6" role="radiogroup">
              {(["email", "sms"] as const).map((v) => (
                <label key={v} className="flex cursor-pointer items-center gap-2">
                  <input type="radio" name="via" checked={via === v} onChange={() => { setVia(v); setValue(""); setError(""); }} className="h-5 w-5 accent-brand" />
                  {v === "email" ? "Email" : "Text message (SMS)"}
                </label>
              ))}
            </div>
          )}
          <p className="text-sm text-muted">{via === "email" ? "We'll email you a link and a code to reset your password." : "We'll text you a code to reset your password."}</p>
          {via === "email" ? (
            <Field tone="dark" label="Email address" type="email" autoComplete="email" value={value} onChange={(e) => setValue(e.target.value)} error={error} />
          ) : (
            <Field tone="dark" label="Phone number (e.g. 0803 123 4567)" type="tel" autoComplete="tel" value={value} onChange={(e) => setValue(e.target.value)} error={error} />
          )}
          <PrimaryButton type="submit" loading={loading} className="!h-12 !text-base">{via === "email" ? "Email Me" : "Text Me"}</PrimaryButton>
          <Link href="/login" className="block text-center text-white hover:underline">Back to Sign In</Link>
        </form>
      )}
    </div>
  );
}
