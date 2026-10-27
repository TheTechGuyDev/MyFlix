"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { emailExists, getAccount, nextStep, signUp } from "@/lib/mock-auth";
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
    if (await emailExists(email)) {
      setLoading(false);
      setFormError("exists");
      return;
    }
    const res = await signUp(email, password);
    setLoading(false);
    if (!res.ok) return setFormError(res.error);
    router.push("/signup/plan");
  };

  const hasEmail = Boolean(params.get("email"));

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
          I agree to the <Link href="/#faq" className="text-brand underline">Terms of Use</Link> and{" "}
          <Link href="/#faq" className="text-brand underline">Privacy Statement</Link>, and confirm I am over 18.
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
