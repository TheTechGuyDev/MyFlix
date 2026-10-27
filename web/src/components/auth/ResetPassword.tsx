"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { nextStep, resetPassword, resetTokenEmail } from "@/lib/mock-auth";
import { Alert, Field, PrimaryButton, validatePassword } from "./ui";

export default function ResetPassword() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [email] = useState(() => (typeof window === "undefined" ? null : resetTokenEmail(token)));
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validatePassword(pw);
    if (v) return setErr(v);
    if (pw !== pw2) return setErr("Passwords don't match.");
    setLoading(true);
    const r = await resetPassword(token, pw);
    setLoading(false);
    if (!r.ok) return setErr(r.error);
    router.push(nextStep(r.data));
  };

  return (
    <div className="w-full bg-black/75 px-5 py-10 sm:max-w-md sm:rounded-lg sm:px-12 sm:py-12">
      {!email ? (
        <div className="space-y-4">
          <h1 className="text-3xl font-bold">Link expired</h1>
          <p className="text-muted">This password reset link has expired or was already used. Links work for 1 hour.</p>
          <Link href="/login/forgot" className="inline-block rounded bg-brand px-5 py-3 font-semibold hover:bg-brand-hover">Send a new link</Link>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          <h1 className="text-3xl font-bold">Create a new password</h1>
          <p className="text-muted">For <b className="text-white">{email}</b>. Use 6 to 60 characters.</p>
          {err && <Alert tone="dark">{err}</Alert>}
          <Field tone="dark" label="New password" revealable autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          <Field tone="dark" label="Confirm new password" revealable autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          <PrimaryButton type="submit" loading={loading} className="!h-12 !text-base">Save and sign in</PrimaryButton>
        </form>
      )}
    </div>
  );
}
