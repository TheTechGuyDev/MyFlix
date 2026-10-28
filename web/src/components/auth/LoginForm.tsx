"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getAccount, nextStep, requestSignInCode, signIn, verifySignInCode } from "@/lib/account";
import { isPhoneLike } from "@/lib/messaging";
import { siteSettings } from "@/lib/site-settings";
import { Alert, Field, PrimaryButton, validateEmail } from "./ui";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const site = siteSettings();
  const codesAvailable = site.emailCodesEnabled || site.smsEnabled;
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState(params.get("suspended") ? "This account has been suspended. Contact MyFlix support to restore access." : "");
  const [loading, setLoading] = useState(false);
  const [useCode, setUseCode] = useState(false);
  const [codeSent, setCodeSent] = useState("");
  const [code, setCode] = useState("");

  useEffect(() => {
    const acc = getAccount();
    if (acc) router.replace(nextStep(acc));
  }, [router]);

  const idLabel = site.smsEnabled ? "Email or mobile number" : "Email address";

  const submitCode = async () => {
    setFormError("");
    const id = email.trim();
    if (!codeSent) {
      if (!id || (isPhoneLike(id) ? !site.smsEnabled : validateEmail(id))) return setErrors({ email: site.smsEnabled ? "Enter your email or mobile number." : "Enter your email address." });
      setErrors({});
      setLoading(true);
      const r = await requestSignInCode(id);
      setLoading(false);
      if (!r.ok) return setFormError(r.error);
      setCodeSent(r.data.to);
      return;
    }
    if (!/^\d{6}$/.test(code)) return setFormError("Enter the 6-digit code.");
    setLoading(true);
    const r = await verifySignInCode(id, code);
    setLoading(false);
    if (!r.ok) return setFormError(r.error);
    router.push(nextStep(r.data));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (useCode) return submitCode();
    const next = {
      email: validateEmail(email) || undefined,
      password: password ? undefined : "Enter your password.",
    };
    setErrors(next);
    setFormError("");
    if (next.email || next.password) return;
    setLoading(true);
    const res = await signIn(email, password);
    setLoading(false);
    if (!res.ok) return setFormError(res.error);
    router.push(nextStep(res.data));
  };

  return (
    <div className="w-full bg-black/75 px-5 py-10 sm:max-w-md sm:rounded-lg sm:px-16 sm:py-14">
      <h1 className="mb-7 text-3xl font-bold">Sign In</h1>
      <form onSubmit={submit} noValidate className="space-y-4">
        {formError && <Alert tone="dark">{formError}</Alert>}
        <Field tone="dark" label={useCode ? idLabel : "Email address"} type={useCode ? "text" : "email"} autoComplete={useCode ? "username" : "email"} value={email} disabled={Boolean(codeSent)} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        {!useCode && <Field tone="dark" label="Password" revealable autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />}
        {useCode && codeSent && (
          <>
            <p className="text-sm text-muted">We sent a 6-digit code to <b className="text-white">{codeSent}</b>.</p>
            <Field tone="dark" label="Sign-in code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          </>
        )}
        <PrimaryButton type="submit" loading={loading} className="!h-12 !text-base">{useCode ? (codeSent ? "Sign In" : "Send Sign-In Code") : "Sign In"}</PrimaryButton>
        {codesAvailable && (
          <>
            <p className="text-center text-muted">OR</p>
            <button
              type="button"
              onClick={() => { setUseCode(!useCode); setCodeSent(""); setCode(""); setFormError(""); setErrors({}); }}
              className="h-12 w-full rounded bg-white/20 font-semibold text-white hover:bg-white/30"
            >
              {useCode ? "Use Password" : "Use a Sign-In Code"}
            </button>
          </>
        )}
        <div className="text-center">
          {useCode && codeSent ? (
            <button type="button" onClick={() => { setCodeSent(""); setCode(""); }} className="text-white hover:underline">Resend code</button>
          ) : (
            <Link href="/login/forgot" className="text-white hover:underline">Forgot password?</Link>
          )}
        </div>
      </form>
      <p className="mt-8 text-muted">
        New to MyFlix?{" "}
        <Link href="/signup" className="font-semibold text-white hover:underline">Sign up now.</Link>
      </p>
      <p className="mt-4 text-xs text-muted">
        By signing in you agree to our <Link href="/terms" className="underline">Terms of Use</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.
      </p>
    </div>
  );
}
