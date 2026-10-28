import Link from "next/link";
import type { ReactNode } from "react";
import Logo from "@/components/landing/Logo";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-neutral-800">
      <header className="bg-ink px-4 py-4 sm:px-10">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Logo />
          <Link href="/" className="text-sm font-semibold text-white hover:underline">Back to MyFlix</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <h1 className="text-3xl font-bold text-neutral-900 sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-neutral-500">Last updated {updated}</p>
        <div className="legal mt-8 space-y-6 leading-relaxed [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-neutral-900 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">{children}</div>
        <nav className="mt-14 flex flex-wrap gap-4 border-t border-neutral-200 pt-6 text-sm">
          <Link href="/terms" className="text-brand hover:underline">Terms of Use</Link>
          <Link href="/privacy" className="text-brand hover:underline">Privacy Policy</Link>
          <Link href="/cookies" className="text-brand hover:underline">Cookie Policy</Link>
          <Link href="/help" className="text-brand hover:underline">Help Centre</Link>
        </nav>
      </main>
    </div>
  );
}
