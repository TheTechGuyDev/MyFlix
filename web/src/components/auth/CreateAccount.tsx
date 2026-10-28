"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getAccount, nextStep, resendSignupCode, signUp, updateNotifications, verifySignupCode, defaultNotifications } from "@/lib/account";
import { siteSettings } from "@/lib/site-settings";
import { Alert, Field, PrimaryButton, validateEmail, validatePassword } from "./ui";
import { StepLabel } from "./SignupShell";

export default function CreateAccount() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [offers, setOffers] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; agree?: string }>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [code, setCode] = useState("");
  const [resent, setResent] = useState(false);

  useEffect(() => {
    const acc = getAccount();
    if (acc) router.replace(nextStep(acc));
  }, [router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = {
      email: validateEmail(email) || undefined,
      password: validatePassword(password) || undefined,
      agree: agree ? undefined : "Please accept the Terms of Use to continue.",
    };
    setErrors(next);
    setFormError("");
    if (next.email || next.password || next.agree) return;

    setLoading(true);
    const ref = params.get("ref") ?? undefined;
    const res = await signUp(email, password, ref?.toUpperCase());
    setLoading(false);
    if (!res.ok) return setFormError(/already exists/.test(res.error) ? "exists" : res.error);
    if (res.data.needsConfirm) return setConfirm(true);
    await finish();
  };

  const finish = async () => {
    if (offers) await updateNotifications({ ...defaultNotifications, offers: true });
    router.push("/signup/plan");
  };

  const onConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return setFormError("Enter the 6-digit code from the email.");
    setLoading(true);
    const r = await verifySignupCode(email, code);
    setLoading(false);
    if (!r.ok) return setFormError(r.error);
    await finish();
  };

  const hasEmail = Boolean(params.get("email"));

  if (confirm) {
    return (
      <form onSubmit={onConfirm} noValidate className="space-y-4">
        <StepLabel step={1} />
        <h1 className="text-3xl font-bold leading-tight">Confirm your email</h1>
        <p className="text-lg">We sent a 6-digit code and a link to <b>{email}</b>. Enter the code, or tap the link in the email.</p>
        {formError && <Alert>{formError}</Alert>}
        <Field label="6-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
        <PrimaryButton type="submit" loading={loading} className="mt-2">Confirm</PrimaryButton>
        <button
          type="button"
          disabled={resent}
          onClick={async () => {
            const r = await resendSignupCode(email);
            setFormError(r.ok ? "" : r.error);
            setResent(true);
          }}
          className="font-semibold text-brand hover:underline disabled:text-neutral-500"
        >
          {resent ? "Code sent again. Check spam too." : "Resend code"}
        </button>
      </form>
    );
  }

  if (!siteSettings().signupsOpen) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">New memberships are paused</h1>
        <p className="text-lg">We&apos;re not accepting new sign-ups right now. Please check back soon.</p>
        <Link href="/login" className="font-semibold text-brand underline">Already a member? Sign in</Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <StepLabel step={1} />
      <h1 className="text-3xl font-bold leading-tight">
        {hasEmail ? "Create a password to start your membership" : "Create your account"}
      </h1>
      <p className="text-lg">Just a few more steps and you&apos;re done! We hate paperwork, too.</p>

      {formError === "exists" ? (
        <Alert>
          Looks like that account already exists.{" "}
          <Link href={`/login?email=${encodeURIComponent(email)}`} className="font-semibold underline">
            Sign in to that account
          </Link>{" "}
          or try a different email.
        </Alert>
      ) : formError ? (
        <Alert>{formError}</Alert>
      ) : null}

      <Field
        label="Email address"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
      />
      <Field
        label="Add a password"
        revealable
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
      />

      <label className="flex items-start gap-3 text-base">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 h-5 w-5 accent-brand" />
        <span>
          I agree to the <Link href="/terms" target="_blank" className="text-brand underline">Terms of Use</Link> and{" "}
          <Link href="/privacy" target="_blank" className="text-brand underline">Privacy Policy</Link>, and confirm I am 18 or older.
        </span>
      </label>
      {errors.agree && <p className="-mt-2 text-sm text-danger">{errors.agree}</p>}

      <label className="flex items-start gap-3 text-base">
        <input type="checkbox" checked={offers} onChange={(e) => setOffers(e.target.checked)} className="mt-1 h-5 w-5 accent-brand" />
        <span>Yes, send me MyFlix news and special offers by email.</span>
      </label>

      <PrimaryButton type="submit" loading={loading} className="mt-4">
        Next
      </PrimaryButton>
    </form>
  );
}
