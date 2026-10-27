"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import Logo from "@/components/landing/Logo";
import { signOut } from "@/lib/mock-auth";
import { useAccount } from "@/lib/use-account";

export default function SignupShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const router = useRouter();
  const { account, ready } = useAccount();

  return (
    <div className="flex min-h-screen flex-col bg-white text-neutral-900">
      <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-4 sm:px-10">
        <Logo tone="light" />
        {ready &&
          (account ? (
            <button
              onClick={() => {
                signOut();
                router.push("/");
              }}
              className="text-base font-semibold hover:underline sm:text-lg"
            >
              Sign Out
            </button>
          ) : (
            <Link href="/login" className="text-base font-semibold hover:underline sm:text-lg">
              Sign In
            </Link>
          ))}
      </header>
      <main className={`mx-auto w-full flex-1 px-5 pb-16 pt-8 sm:pt-12 ${wide ? "max-w-6xl" : "max-w-md"}`}>{children}</main>
      <footer className="border-t border-neutral-200 bg-neutral-100 px-5 py-8 text-sm text-neutral-600 sm:px-10">
        <p className="mb-4">
          Questions? Call <a href="tel:+2348000000000" className="underline">0800 000 0000</a>
        </p>
        <div className="flex flex-wrap gap-x-8 gap-y-2">
          {["FAQ", "Help Centre", "Terms of Use", "Privacy", "Cookie Preferences", "Corporate Information"].map((l) => (
            <Link key={l} href="/#faq" className="underline">
              {l}
            </Link>
          ))}
        </div>
      </footer>
    </div>
  );
}

export function StepLabel({ step, total = 4 }: { step: number; total?: number }) {
  return (
    <p className="text-sm uppercase tracking-wide text-neutral-600">
      Step <b className="text-neutral-900">{step}</b> of <b className="text-neutral-900">{total}</b>
    </p>
  );
}
