"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import Logo from "@/components/landing/Logo";
import Avatar from "@/components/auth/Avatar";
import { getAccount, getActiveProfileId, signOut, type Account } from "@/lib/mock-auth";

type Ctx = { account: Account; refresh: () => void; toast: (m: string) => void };
const AccountCtx = createContext<Ctx | null>(null);
export const useAccountCtx = () => useContext(AccountCtx)!;

const nav = [
  { href: "/account", label: "Overview", icon: "M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
  { href: "/account/plan", label: "Membership", icon: "M3 6h18v12H3zM3 10h18" },
  { href: "/account/security", label: "Security", icon: "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" },
  { href: "/account/devices", label: "Devices", icon: "M3 5h18v11H3zM8 20h8M12 16v4" },
  { href: "/account/profiles", label: "Profiles", icon: "M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM4 21a8 8 0 0 1 16 0" },
  { href: "/account/activity", label: "Viewing activity", icon: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" },
  { href: "/account/invite", label: "Invite & rewards", icon: "M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z" },
];

export default function AccountShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [account, setAccount] = useState<Account | null>(null);
  const [msg, setMsg] = useState("");

  const refresh = useCallback(() => setAccount(getAccount()), []);

  useEffect(() => {
    const a = getAccount();
    if (!a) return router.replace("/login");
    if (!a.payment) return router.replace("/signup/payment");
    setAccount(a);
  }, [router]);

  useEffect(() => {
    if (!msg) return;
    const id = setTimeout(() => setMsg(""), 3000);
    return () => clearTimeout(id);
  }, [msg]);

  if (!account) return <div className="min-h-screen bg-neutral-100" />;
  const active = account.profiles.find((p) => p.id === getActiveProfileId()) ?? account.profiles[0];
  const clean = path.replace(/\/$/, "").replace(/^\/MyFlix/, "") || "/account";

  return (
    <AccountCtx.Provider value={{ account, refresh, toast: setMsg }}>
      <div className="min-h-screen bg-neutral-100 text-neutral-900">
        <header className="flex items-center justify-between bg-ink px-4 py-3 sm:px-10">
          <Logo className="[&_span]:!text-3xl" />
          <div className="flex items-center gap-4 text-sm text-white">
            <Link href="/browse" className="hidden hover:underline sm:inline">Back to MyFlix</Link>
            <button onClick={() => { signOut(); router.push("/"); }} className="hover:underline">Sign Out</button>
            {active && <Avatar index={active.avatar} className="h-8 w-8 rounded" />}
          </div>
        </header>

        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:flex-row md:py-10">
          <nav className="md:w-56 md:shrink-0">
            <Link href="/browse" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-neutral-700 hover:underline">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M11 5l-7 7 7 7" /></svg>
              Back to MyFlix
            </Link>
            <ul className="no-scrollbar flex gap-1 overflow-x-auto md:flex-col">
              {nav.map((n) => {
                const on = n.href === "/account" ? clean === "/account" : clean.startsWith(n.href);
                return (
                  <li key={n.href}>
                    <Link
                      href={n.href}
                      className={`flex items-center gap-3 whitespace-nowrap rounded-md px-3 py-2.5 text-sm font-semibold ${on ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-600 hover:bg-white/60"}`}
                    >
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d={n.icon} /></svg>
                      {n.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <main className="min-w-0 flex-1">{children}</main>
        </div>

        {msg && (
          <div role="status" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md bg-neutral-900 px-5 py-3 text-sm text-white shadow-xl">
            {msg}
          </div>
        )}
      </div>
    </AccountCtx.Provider>
  );
}

/* ---------- Small UI helpers shared by account pages ---------- */

export function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl bg-white p-5 shadow-sm sm:p-6 ${className}`}>
      {title && <h2 className="mb-4 text-lg font-bold">{title}</h2>}
      {children}
    </section>
  );
}

export function LinkRow({ href, label, sub, onClick, danger }: { href?: string; label: string; sub?: string; onClick?: () => void; danger?: boolean }) {
  const inner = (
    <>
      <span>
        <span className={`block font-semibold ${danger ? "text-danger" : ""}`}>{label}</span>
        {sub && <span className="block text-sm text-neutral-500">{sub}</span>}
      </span>
      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-neutral-400" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 5 7 7-7 7" /></svg>
    </>
  );
  const cls = "flex w-full items-center justify-between gap-3 border-t border-neutral-200 py-4 text-left first:border-t-0 hover:bg-neutral-50";
  return href ? <Link href={href} className={cls}>{inner}</Link> : <button onClick={onClick} className={cls}>{inner}</button>;
}

export function PageTitle({ title, sub, back }: { title: string; sub?: string; back?: string }) {
  return (
    <div className="mb-6">
      {back && (
        <Link href={back} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-neutral-600 hover:underline">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 5-7 7 7 7" /></svg>
          Back
        </Link>
      )}
      <h1 className="text-3xl font-bold">{title}</h1>
      {sub && <p className="mt-1 text-neutral-600">{sub}</p>}
    </div>
  );
}

export function Toggle({ on, onChange, label, sub }: { on: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 border-t border-neutral-200 py-4 first:border-t-0">
      <span>
        <span className="block font-semibold">{label}</span>
        {sub && <span className="block text-sm text-neutral-500">{sub}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
        className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-brand" : "bg-neutral-300"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}

export const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" }) : "";
