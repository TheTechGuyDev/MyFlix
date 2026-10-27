"use client";

import Link from "next/link";
import { useState } from "react";
import { requestPasswordReset } from "@/lib/mock-auth";
import { Field, PrimaryButton, validateEmail } from "./ui";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateEmail(email);
    setError(err);
    if (err) return;
    setLoading(true);
    await requestPasswordReset(email);
    setLoading(false);
    setSent(true);
  };

  return (
    <div className="w-full bg-black/75 px-5 py-10 sm:max-w-md sm:rounded-lg sm:px-12 sm:py-12">
      {sent ? (
        <div className="space-y-4">
          <h1 className="text-3xl font-bold">Check your email</h1>
          <p className="text-muted">
            If an account exists for <b className="text-white">{email}</b>, we&apos;ve sent a link to reset your password. It
            expires in 1 hour. Don&apos;t forget to check your spam folder.
          </p>
          <Link href="/login" className="inline-block font-semibold text-white hover:underline">Back to Sign In</Link>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          <h1 className="text-3xl font-bold">Forgot your password?</h1>
          <p className="text-muted">Enter the email on your account and we&apos;ll send you a link to reset your password.</p>
          <Field tone="dark" label="Email address" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error} />
          <PrimaryButton type="submit" loading={loading} className="!h-12 !text-base">Email Me</PrimaryButton>
          <Link href="/login" className="block text-center text-white hover:underline">Back to Sign In</Link>
        </form>
      )}
    </div>
  );
}
