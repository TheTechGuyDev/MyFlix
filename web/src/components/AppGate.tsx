"use client";

import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { boot, useStore } from "@/lib/store";

/** Public pages that render straight away (SEO); everything else waits for the account to load. */
const PUBLIC = [/^\/$/, /^\/(terms|privacy|cookies|legal)\/?$/];

export default function AppGate({ children }: { children: ReactNode }) {
  const path = (usePathname() || "/").replace(process.env.NEXT_PUBLIC_BASE_PATH ?? "", "") || "/";
  const ready = useStore((s) => s.ready);
  const error = useStore((s) => s.error);

  useEffect(() => {
    void boot();
  }, []);

  if (PUBLIC.some((r) => r.test(path))) return <>{children}</>;
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink">
        <p className="font-display animate-pulse text-5xl tracking-wide">
          MY<span className="text-brand-bright">FLIX</span>
        </p>
      </div>
    );
  }
  if (error === "not-configured") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ink px-6 text-center">
        <p className="font-display text-5xl">MY<span className="text-brand-bright">FLIX</span></p>
        <h1 className="text-2xl font-bold">We&apos;re getting ready</h1>
        <p className="max-w-md text-white/70">MyFlix is finishing setup. Please check back shortly.</p>
      </div>
    );
  }
  return <>{children}</>;
}
