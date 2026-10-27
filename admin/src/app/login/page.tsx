"use client";

import { Eye, EyeOff, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Field, Input } from "@/components/ui";
import { DEMO_PASSWORD } from "@/lib/seed";
import { currentStaff, ensureStaff, getDb, login } from "@/lib/store";

const demo = [
  ["Super Admin", "admin@myflix.ng"],
  ["Content Manager", "content@myflix.ng"],
  ["Support", "support@myflix.ng"],
  ["Finance", "finance@myflix.ng"],
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    ensureStaff().then(() => {
      if (currentStaff(getDb())) router.replace("/");
    });
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const r = await login(email, pw);
    setLoading(false);
    if (r) return setErr(r);
    router.replace("/");
  };

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
            <li>• Curate the home screen and launch campaigns</li>
          </ul>
          <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-brand-bright/30 blur-3xl" />
        </div>
        <form onSubmit={submit} className="glass space-y-4 p-8 md:rounded-none">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-xl bg-brand/10 p-2 text-brand"><Lock size={18} /></span>
            <div>
              <h1 className="text-xl font-bold">Staff sign in</h1>
              <p className="text-xs text-slate-500">Use your MyFlix staff account</p>
            </div>
          </div>
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
          <Button className="w-full" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</Button>
          <div className="rounded-xl bg-slate-900/5 p-3 text-xs dark:bg-white/5">
            <p className="mb-2 font-semibold">Demo staff accounts (password: {DEMO_PASSWORD})</p>
            <div className="grid grid-cols-2 gap-1.5">
              {demo.map(([role, e]) => (
                <button type="button" key={e} onClick={() => { setEmail(e); setPw(DEMO_PASSWORD); }} className="rounded-lg bg-white/70 px-2 py-1.5 text-left hover:bg-white dark:bg-white/5 dark:hover:bg-white/10">
                  <span className="block font-semibold">{role}</span>
                  <span className="text-slate-500">{e}</span>
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
