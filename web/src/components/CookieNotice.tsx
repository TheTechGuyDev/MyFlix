"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

const KEY = "myflix.cookies";
const listeners = new Set<() => void>();
const read = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return "essential";
  }
};

/** MyFlix only uses essential storage (sign-in, preferences); this notice says so once. */
export default function CookieNotice() {
  const choice = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => "server",
  );
  if (choice !== null) return null;
  const accept = () => {
    try {
      localStorage.setItem(KEY, "essential");
    } catch {
      /* ignore */
    }
    listeners.forEach((l) => l());
  };
  return (
    <div role="dialog" aria-label="Cookies" className="fixed inset-x-3 bottom-3 z-[90] mx-auto flex max-w-3xl flex-col gap-3 rounded-lg border border-white/10 bg-[#141416]/95 p-4 text-sm text-white shadow-2xl backdrop-blur sm:flex-row sm:items-center">
      <p className="flex-1 text-white/80">
        MyFlix uses essential cookies and browser storage to keep you signed in and remember your settings. We don&apos;t use advertising cookies.{" "}
        <Link href="/cookies" className="font-semibold text-brand-bright hover:underline">Cookie policy</Link>
      </p>
      <button onClick={accept} className="h-10 shrink-0 rounded bg-brand px-5 font-semibold hover:bg-brand-hover">OK</button>
    </div>
  );
}
