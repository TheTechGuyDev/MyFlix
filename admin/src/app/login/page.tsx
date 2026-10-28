"use client";

import { Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Field, Input } from "@/components/ui";
import { login, logout, nextMfaStep, restoreSession, verifyMfa, type LoginStep } from "@/lib/store";
import { backendConfigured, sb } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<LoginStep | null>(null);
  const [code, setCode] = useState("");
  const [invite, setInvite] = useState(false);

  const setPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return setErr("Use at least 8 characters for a staff password.");
    setLoading(true);
    const { error } = await sb().auth.updateUser({ password: pw });
    setLoading(false);
    if (error) return setErr(error.message);
    setErr("");
    setInvite(false);
    setPw("");
    setStep(await nextMfaStep());
  };
  const [timedOut] = useState(() => typeof window !== "undefined" && new URLSearchParams(location.search).has("timeout"));

  useEffect(() => {
    // Already signed in with two-step? Go straight in. Half signed in (password only)? Continue to the code.
    (async () => {
      // Staff invite link from email: confirm it here, then ask for a password
      const q = new URLSearchParams(location.search);
      const hash = q.get("token_hash");
      if (hash && q.get("type") === "invite") {
        let { error } = await sb().auth.verifyOtp({ token_hash: hash, type: "invite" });
        if (error && hash.startsWith("pkce_")) ({ error } = await sb().auth.verifyOtp({ token_hash: hash.slice(5), type: "invite" }));
        history.replaceState(null, "", location.pathname);
        if (error) return setErr("This invite link has expired or was already used. Ask a Super Admin to invite you again.");
        return setInvite(true);
      }
      if (await restoreSession()) return router.replace("/");
      const { data } = await sb().auth.getSession();
      if (data.session && new URLSearchParams(location.search).has("invite")) return setInvite(true);
      if (data.session) setStep(await nextMfaStep());
    })();
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const r = await login(email, pw);
    setLoading(false);
    if (r.step === "error") return setErr(r.error);
    if (r.step === "done") {
      await restoreSession();
      return router.replace("/");
    }
    setStep(r);
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!step || (step.step !== "mfa-enroll" && step.step !== "mfa-verify")) return;
    if (!/^\d{6}$/.test(code)) return setErr("Enter the 6-digit code from your authenticator app.");
    setErr("");
    setLoading(true);
    const r = await verifyMfa(step.factorId, code);
    if (r) {
      setLoading(false);
      return setErr(r);
    }
    const ok = await restoreSession();
    setLoading(false);
    if (!ok) return setErr("This account isn't MyFlix staff.");
    router.replace("/");
  };

  const mfa = step && (step.step === "mfa-enroll" || step.step === "mfa-verify");

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl md:grid-cols-2">
        <div className="relative hidden bg-gradient-to-br from-brand to-[#062c1d] p-10 text-white md:block">
          <p className="font-display text-6xl leading-none">MY<span className="text-brand-bright">FLIX</span></p>
          <p className="mt-2 text-sm font-semibold uppercase tracking-widest text-white/70">Admin Console</p>
          <p className="mt-16 text-3xl font-bold leading-tight">Run Nigeria&apos;s home of Nollywood from one place.</p>
          <ul className="mt-6 space-y-2 text-sm text-white/85">
            <li>• Upload and publish titles in up to 4K</li>
            <li>• Track members, revenue and watch time</li>
            <li>• Two-step sign-in and a full audit log for every action</li>
          </ul>
          <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-brand-bright/30 blur-3xl" />
        </div>

        {invite ? (
          <form onSubmit={setPassword} className="glass space-y-4 p-8 md:rounded-none">
            <h1 className="text-xl font-bold">Welcome to MyFlix Admin</h1>
            <p className="text-sm text-slate-500">Create your password. Next you&apos;ll set up two-step sign-in.</p>
            {err && <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-600">{err}</p>}
            <Field label="New password (8+ characters)">
              <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" required />
            </Field>
            <Button className="w-full" disabled={loading}>{loading ? "Saving…" : "Save password"}</Button>
          </form>
        ) : !mfa ? (
          <form onSubmit={submit} className="glass space-y-4 p-8 md:rounded-none">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-xl bg-brand/10 p-2 text-brand"><Lock size={18} /></span>
              <div>
                <h1 className="text-xl font-bold">Staff sign in</h1>
                <p className="text-xs text-slate-500">Use your MyFlix staff account</p>
              </div>
            </div>
            {!backendConfigured && <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-700">The backend isn&apos;t connected to this build yet.</p>}
            {timedOut && !err && <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-700">You were signed out after a period of inactivity.</p>}
            {err && <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-600">{err}</p>}
            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@myflix.ng" autoComplete="username" required />
            </Field>
            <Field label="Password">
              <div className="relative">
                <Input type={show ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" required />
                <button type="button" onClick={() => setShow(!show)} aria-label="Show password" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
            </Field>
            <Button className="w-full" disabled={loading}>{loading ? "Signing in…" : "Continue"}</Button>
            <p className="text-xs text-slate-500">
              First time? The platform owner creates a MyFlix account on the website with the owner email, then signs in here. Other staff are invited from Staff &amp; Roles and set their password from the invite email.
            </p>
          </form>
        ) : (
          <form onSubmit={verify} className="glass space-y-4 p-8 md:rounded-none">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-xl bg-brand/10 p-2 text-brand"><ShieldCheck size={18} /></span>
              <div>
                <h1 className="text-xl font-bold">{step.step === "mfa-enroll" ? "Set up two-step sign-in" : "Two-step verification"}</h1>
                <p className="text-xs text-slate-500">Required for all MyFlix staff</p>
              </div>
            </div>
            {step.step === "mfa-enroll" && (
              <div className="space-y-3 text-sm">
                <p>1. Install an authenticator app (Google Authenticator, Microsoft Authenticator or Authy).</p>
                <p>2. Scan this code with the app:</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={step.qr} alt="Two-step sign-in QR code" className="mx-auto h-44 w-44 rounded-xl bg-white p-2" />
                <p className="text-xs text-slate-500">Can&apos;t scan? Enter this key: <code className="break-all font-mono">{step.secret}</code></p>
                <p>3. Enter the 6-digit code the app shows:</p>
              </div>
            )}
            {step.step === "mfa-verify" && <p className="text-sm">Open your authenticator app and enter the 6-digit code for MyFlix Admin.</p>}
            {err && <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-600">{err}</p>}
            <Field label="6-digit code">
              <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus />
            </Field>
            <Button className="w-full" disabled={loading}>{loading ? "Checking…" : "Verify and sign in"}</Button>
            <button type="button" onClick={async () => { await logout(); setStep(null); setCode(""); }} className="w-full text-center text-xs text-slate-500 hover:underline">Use a different account</button>
            <p className="text-xs text-slate-500">Lost your phone? Ask a Super Admin to reset your two-step sign-in in Staff &amp; Roles.</p>
          </form>
        )}
      </div>
    </div>
  );
}
