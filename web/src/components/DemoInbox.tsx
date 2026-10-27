"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MESSAGE_EVENT, type OutMsg } from "@/lib/messaging";

/**
 * Demo-only: shows emails and SMS the platform "sends", so reset links and sign-in codes can be
 * used without a real mail/SMS provider. Remove when Supabase + a provider are connected.
 */
export default function DemoInbox() {
  const [msgs, setMsgs] = useState<OutMsg[]>([]);

  useEffect(() => {
    const on = (e: Event) => {
      const m = (e as CustomEvent<OutMsg>).detail;
      if (m.channel === "push") return;
      setMsgs((l) => [m, ...l].slice(0, 3));
    };
    window.addEventListener(MESSAGE_EVENT, on);
    return () => window.removeEventListener(MESSAGE_EVENT, on);
  }, []);

  if (!msgs.length) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 left-4 right-4 z-[100] flex flex-col gap-2 sm:left-auto sm:w-96">
      {msgs.map((m) => (
        <div key={m.id} role="status" className="pointer-events-auto rounded-lg border border-white/10 bg-[#141416]/95 p-4 text-sm text-white shadow-2xl backdrop-blur">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="rounded bg-brand/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-brand-bright">
              Demo {m.channel === "sms" ? "SMS" : "email"} to {m.to}
            </span>
            <button aria-label="Dismiss" onClick={() => setMsgs((l) => l.filter((x) => x.id !== m.id))} className="text-white/60 hover:text-white">✕</button>
          </div>
          <p className="font-semibold">{m.subject}</p>
          <p className="mt-1 whitespace-pre-line text-white/70">{m.body}</p>
          {m.link && (
            <Link href={m.link} onClick={() => setMsgs((l) => l.filter((x) => x.id !== m.id))} className="mt-2 inline-block font-semibold text-brand-bright hover:underline">
              Open link
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
