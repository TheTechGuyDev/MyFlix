"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Logo from "@/components/landing/Logo";
import { createTicket, ticketsFor } from "@/lib/extras";
import { faqs } from "@/lib/landing-data";
import { getAccount } from "@/lib/mock-auth";
import { siteSettings } from "@/lib/site-settings";

const more = [
  { question: "Why is my video buffering?", answer: ["Restart your router, close other apps using data, and set Data usage to Automatic in Profile Settings. Data Saver keeps playback smooth on weak networks."] },
  { question: "How do I sign in on my TV?", answer: ["On the TV choose Sign in with phone. Then on your phone or computer go to Account, Sign in on a TV, and enter the 8-digit code."] },
  { question: "Can I set limits for my children?", answer: ["Yes. Kids profiles only show family titles. You can also add a PIN, a maturity rating and a daily viewing limit for any profile under Account, Profiles."] },
  { question: "How do gift cards and promo codes work?", answer: ["Promo codes are entered when you pay. Gift cards are redeemed under Account, Redeem gift card, and the credit is used before you are charged."] },
  { question: "How do I invite a friend?", answer: ["Go to Account, Invite friends. When a friend joins with your code and pays, you both get a free month."] },
];

type Ticket = ReturnType<typeof ticketsFor>[number];

export default function HelpCentre() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<"Billing" | "Playback" | "Account" | "Content" | "Other">("Playback");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [err, setErr] = useState("");
  const [sent, setSent] = useState("");
  const [mine, setMine] = useState<Ticket[]>([]);
  const site = siteSettings();

  useEffect(() => {
    const a = getAccount();
    if (a) {
      setEmail(a.email);
      setName(a.profiles[0]?.name ?? "");
      setMine(ticketsFor(a.email));
    }
  }, []);

  const all = useMemo(() => [...faqs, ...more], []);
  const list = all.filter((f) => !q.trim() || (f.question + f.answer.join(" ")).toLowerCase().includes(q.trim().toLowerCase()));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr("Enter a valid email so we can reply.");
    if (subject.trim().length < 4 || body.trim().length < 10) return setErr("Tell us a little more about the problem.");
    const id = createTicket({ email: email.trim().toLowerCase(), name: name.trim() || email.split("@")[0], category, subject: subject.trim(), body: body.trim() });
    setErr("");
    setSent(id);
    setSubject("");
    setBody("");
    setMine(ticketsFor(email.trim().toLowerCase()));
  };

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <header className="bg-ink px-4 py-4 sm:px-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Logo />
          <Link href="/browse" className="text-sm font-semibold text-white hover:underline">Back to MyFlix</Link>
        </div>
      </header>
      <section className="bg-gradient-to-b from-ink to-[#0b2b1f] px-4 pb-14 pt-10 text-center text-white">
        <h1 className="text-3xl font-bold sm:text-4xl">Help Centre</h1>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search for help, e.g. data, payment, TV" aria-label="Search help" className="mx-auto mt-6 h-14 w-full max-w-xl rounded-lg px-4 text-lg text-neutral-900 outline-none" />
      </section>
      <main className="mx-auto max-w-5xl space-y-10 px-4 py-10">
        <section>
          <h2 className="mb-4 text-xl font-bold">Popular topics</h2>
          <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200">
            {list.map((f, i) => (
              <li key={f.question}>
                <button onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i} className="flex w-full items-center justify-between px-5 py-4 text-left font-semibold hover:bg-neutral-50">
                  {f.question}
                  <span className="text-2xl text-neutral-400">{open === i ? "−" : "+"}</span>
                </button>
                {open === i && <div className="space-y-2 px-5 pb-5 text-neutral-700">{f.answer.map((p) => <p key={p}>{p}</p>)}</div>}
              </li>
            ))}
            {list.length === 0 && <li className="px-5 py-6 text-neutral-500">No answers found. Send us a message below.</li>}
          </ul>
        </section>

        <section className="grid gap-8 md:grid-cols-[1fr_320px]">
          <form onSubmit={submit} className="space-y-3 rounded-xl border border-neutral-200 p-5">
            <h2 className="text-xl font-bold">Contact us</h2>
            <p className="text-sm text-neutral-600">We reply within a few hours, 8am to 10pm every day.</p>
            {sent && <p className="rounded bg-emerald-50 p-3 text-sm text-emerald-800">Thanks! Your request <b>{sent}</b> has been sent. We&apos;ll email you, and you can track it here.</p>}
            {err && <p className="rounded bg-amber-50 p-3 text-sm text-amber-900">{err}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" aria-label="Your name" className="h-11 rounded border border-neutral-300 px-3" />
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" aria-label="Email" className="h-11 rounded border border-neutral-300 px-3" />
            </div>
            <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)} aria-label="Topic" className="h-11 w-full rounded border border-neutral-300 bg-white px-3">
              {["Playback", "Billing", "Account", "Content", "Other"].map((c) => <option key={c}>{c}</option>)}
            </select>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" aria-label="Subject" className="h-11 w-full rounded border border-neutral-300 px-3" />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Describe the problem. Include your device and network if it's about playback." aria-label="Message" className="min-h-32 w-full rounded border border-neutral-300 p-3" />
            <button className="h-11 rounded bg-brand px-6 font-semibold text-white hover:bg-brand-hover">Send message</button>
          </form>
          <aside className="space-y-4">
            <div className="rounded-xl bg-neutral-100 p-5">
              <p className="font-bold">Call us</p>
              <a href={`tel:${site.supportPhone.replace(/\s/g, "")}`} className="text-lg text-brand">{site.supportPhone}</a>
              <p className="mt-3 font-bold">Email</p>
              <a href={`mailto:${site.supportEmail}`} className="text-brand">{site.supportEmail}</a>
              <p className="mt-3 font-bold">WhatsApp</p>
              <a href="https://wa.me/2348000000000" className="text-brand">Chat with support</a>
            </div>
            {mine.length > 0 && (
              <div className="rounded-xl border border-neutral-200 p-5">
                <p className="mb-3 font-bold">Your requests</p>
                <ul className="space-y-3 text-sm">
                  {mine.map((t) => (
                    <li key={t.id}>
                      <p className="font-semibold">{t.subject}</p>
                      <p className="text-neutral-500">{t.id} · <span className={t.status === "resolved" ? "text-emerald-700" : "text-amber-700"}>{t.status === "pending" ? "replied" : t.status}</span></p>
                      {t.messages.filter((m) => m.from === "staff").slice(-1).map((m) => <p key={m.at} className="mt-1 rounded bg-neutral-100 p-2 text-neutral-700">{m.author}: {m.body}</p>)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </section>
      </main>
    </div>
  );
}
