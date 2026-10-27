"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getAccount, nextStep, signIn } from "@/lib/mock-auth";
import { Alert, Field, PrimaryButton, validateEmail } from "./ui";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const acc = getAccount();
    if (acc) router.replace(nextStep(acc));
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = {
      email: validateEmail(email) || undefined,
      password: password ? undefined : "Your password must contain at least 6 characters.",
    };
    setErrors(next);
    setFormError("");
    if (next.email || next.password) return;
    setLoading(true);
    const res = await signIn(email, password, remember);
    setLoading(false);
    if (!res.ok) return setFormError(res.error);
    router.push(nextStep(res.data));
  };

  return (
    <div className="w-full bg-black/75 px-5 py-10 sm:max-w-md sm:rounded-lg sm:px-16 sm:py-14">
      <h1 className="mb-7 text-3xl font-bold">Sign In</h1>
      <form onSubmit={submit} noValidate className="space-y-4">
        {formError && <Alert tone="dark">{formError}</Alert>}
        <Field tone="dark" label="Email address" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <Field tone="dark" label="Password" revealable autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
        <PrimaryButton type="submit" loading={loading} className="!h-12 !text-base">Sign In</PrimaryButton>
        <div className="text-center">
          <Link href="/login/forgot" className="text-white hover:underline">Forgot password?</Link>
        </div>
        <label className="flex items-center gap-3 text-white">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-5 w-5 accent-brand" />
          Remember me
        </label>
      </form>
      <p className="mt-8 text-muted">
        New to MyFlix?{" "}
        <Link href="/signup" className="font-semibold text-white hover:underline">Sign up now.</Link>
      </p>
      <p className="mt-4 text-xs text-muted">
        This page is protected to make sure you&apos;re not a bot. Your details are never shared.
      </p>
    </div>
  );
}
