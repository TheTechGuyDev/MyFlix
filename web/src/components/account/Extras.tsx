"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import Avatar from "@/components/auth/Avatar";
import { PrimaryButton } from "@/components/auth/ui";
import { byId, img } from "@/lib/catalog";
import { activityOf, clearActivity, hideActivity, loadUsage, referralCode, thisMonth, watchedTodayMinutes, type ActivityItem } from "@/lib/extras";
import { getActiveProfileId, redeemGiftCard, settingsOf } from "@/lib/account";
import { loadLibrary } from "@/lib/library";
import { naira } from "@/lib/plans";
import { Card, PageTitle, fmtDate, useAccountCtx } from "./AccountShell";
import { approveTvCode, formatTvCode } from "@/lib/tv";

/* ---------------- Viewing activity ---------------- */
export function Activity() {
  const { account } = useAccountCtx();
  const [pid, setPid] = useState(getActiveProfileId() ?? account.profiles[0]?.id ?? "");
  const [tab, setTab] = useState<"watched" | "rated">("watched");
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!pid) return;
    activityOf(pid).then(setItems);
    loadLibrary(pid).then((l) => setRatings(l.ratings));
  }, [pid]);

  const download = () => {
    const rows = ["Title,Episode,Date", ...items.map((i) => `"${byId(i.titleId)?.title ?? i.titleId}",${i.season ? `S${i.season}:E${i.episode}` : ""},${fmtDate(i.at)}`)];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv" }));
    a.download = "myflix-viewing-activity.csv";
    a.click();
  };

  return (
    <div className="space-y-6">
      <PageTitle title="Viewing activity" sub="What each profile has watched and rated." />
      <div className="flex flex-wrap gap-2">
        {account.profiles.map((p) => (
          <button key={p.id} onClick={() => setPid(p.id)} className={`flex items-center gap-2 rounded-full border-2 py-1 pl-1 pr-3 text-sm font-semibold ${pid === p.id ? "border-neutral-900" : "border-transparent bg-white"}`}>
            <Avatar index={p.avatar} className="h-7 w-7 rounded-full" /> {p.name}
          </button>
        ))}
      </div>
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {(["watched", "rated"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === t ? "bg-neutral-900 text-white" : "bg-neutral-100"}`}>
              {t === "watched" ? "Watched" : "Rated"}
            </button>
          ))}
          {tab === "watched" && items.length > 0 && (
            <div className="ml-auto flex gap-3 text-sm">
              <button onClick={download} className="font-semibold text-brand hover:underline">Download all</button>
              <button onClick={async () => { await clearActivity(pid); setItems([]); }} className="font-semibold text-danger hover:underline">Hide all</button>
            </div>
          )}
        </div>
        {tab === "watched" ? (
          items.length === 0 ? (
            <p className="py-8 text-center text-neutral-500">Nothing watched on this profile yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-200">
              {items.map((i) => {
                const t = byId(i.titleId);
                return (
                  <li key={i.id} className="flex items-center gap-3 py-3">
                    <span className="w-28 shrink-0 text-sm text-neutral-500">{fmtDate(i.at)}</span>
                    <span className="flex-1 font-semibold">
                      {t?.title ?? "Removed title"}
                      {i.season ? <span className="font-normal text-neutral-500"> · Season {i.season}, Episode {i.episode}</span> : null}
                    </span>
                    <button onClick={async () => { await hideActivity(pid, i); setItems(await activityOf(pid)); }} className="text-sm text-neutral-500 hover:text-danger" title="Hide from viewing history">Hide</button>
                  </li>
                );
              })}
            </ul>
          )
        ) : Object.keys(ratings).length === 0 ? (
          <p className="py-8 text-center text-neutral-500">No ratings yet. Rate titles with the thumbs buttons.</p>
        ) : (
          <ul className="divide-y divide-neutral-200">
            {Object.entries(ratings).map(([id, r]) => (
              <li key={id} className="flex items-center justify-between py-3">
                <span className="font-semibold">{byId(id)?.title ?? id}</span>
                <span className="text-sm">{r === 2 ? "Love this!" : r === 1 ? "I like this" : "Not for me"}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ---------------- Data meter (overview card) ---------------- */
export function DataMeter() {
  const { account } = useAccountCtx();
  const [rows, setRows] = useState<{ name: string; avatar: number; gb: number; hours: number; today: number; cap?: number; limit?: number }[]>([]);
  useEffect(() => {
    let off = false;
    Promise.all(account.profiles.map((p) => loadUsage(p.id))).then(() => {
      if (off) return;
      setRows(
        account.profiles.map((p) => {
          const m = thisMonth(p.id);
          const s = settingsOf(p);
          return { name: p.name, avatar: p.avatar, gb: m.gb, hours: m.seconds / 3600, today: watchedTodayMinutes(p.id), cap: s.monthlyDataCapGB, limit: s.dailyLimitMinutes };
        }),
      );
    });
    return () => {
      off = true;
    };
  }, [account]);
  const total = rows.reduce((a, r) => a + r.gb, 0);
  return (
    <Card title="Data used this month">
      <p className="text-3xl font-bold">{total.toFixed(2)} GB</p>
      <p className="mb-4 text-sm text-neutral-500">Estimated from what you streamed and the quality used. Set limits per profile.</p>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-3 text-sm">
            <Avatar index={r.avatar} className="h-8 w-8" />
            <span className="w-24 truncate font-semibold">{r.name}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-200">
              <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.min(100, r.cap ? (r.gb / r.cap) * 100 : (r.gb / Math.max(total, 0.01)) * 100)}%` }} />
            </span>
            <span className="w-32 text-right text-neutral-600">
              {r.gb.toFixed(2)} GB{r.cap ? ` / ${r.cap} GB` : ""}
              {r.limit ? <span className="block text-xs">{r.today}/{r.limit} min today</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ---------------- Gift cards ---------------- */
export function GiftCards() {
  const { account, refresh, toast } = useAccountCtx();
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <div className="space-y-6">
      <PageTitle title="Gift cards & credit" back="/account" />
      <Card>
        <p className="text-sm text-neutral-500">Account credit</p>
        <p className="text-3xl font-bold">{naira(account.credit ?? 0)}</p>
        <p className="mt-1 text-sm text-neutral-600">Credit is used before your card or bank is charged.</p>
      </Card>
      <Card title="Redeem a gift card">
        <div className="flex max-w-md gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="MYF-XXXXXX" aria-label="Gift card code" className="h-12 flex-1 rounded border border-neutral-400 px-3 font-mono text-lg uppercase outline-none focus:ring-2 focus:ring-neutral-900" />
          <PrimaryButton
            loading={loading}
            className="!h-12 !w-32 !text-base"
            onClick={async () => {
              setErr("");
              setLoading(true);
              const r = await redeemGiftCard(code);
              setLoading(false);
              if (!r.ok) return setErr(r.error);
              refresh();
              setCode("");
              toast(`${naira(r.data)} added to your account.`);
            }}
          >
            Redeem
          </PrimaryButton>
        </div>
        {err && <p className="mt-2 text-sm text-danger">{err}</p>}
        <p className="mt-3 text-sm text-neutral-500">Gift cards are sold by MyFlix partners and never expire.</p>
      </Card>
    </div>
  );
}

/* ---------------- Referrals ---------------- */
export function Invite() {
  const { account, toast } = useAccountCtx();
  const code = referralCode();
  const link = typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname.replace(/\/account.*$/, "")}/signup?ref=${code}` : "";
  const msg = `Join me on MyFlix: Nollywood, movies and series from ₦1,500. Use my code ${code} and we both get a free month: ${link}`;
  return (
    <div className="space-y-6">
      <PageTitle title="Invite friends, get free months" back="/account" sub="When a friend joins with your code and pays their first month, you both get one month free." />
      <Card>
        <p className="text-sm text-neutral-500">Your code</p>
        <p className="font-mono text-4xl font-bold tracking-widest">{code}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => { navigator.clipboard?.writeText(link); toast("Invite link copied."); }} className="h-11 rounded bg-neutral-900 px-5 font-semibold text-white">Copy link</button>
          <a href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center rounded bg-[#25D366] px-5 font-semibold text-white">Share on WhatsApp</a>
          <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center rounded border border-neutral-900 px-5 font-semibold">Share on X</a>
        </div>
      </Card>
      <Card title="How it works">
        <ol className="list-inside list-decimal space-y-2 text-neutral-700">
          <li>Share your link or code with friends and family.</li>
          <li>They sign up and pay for their first month.</li>
          <li>You both get a free month, added automatically.</li>
        </ol>
        {account.referredBy && <p className="mt-4 text-sm text-brand">You joined with code {account.referredBy}.</p>}
      </Card>
    </div>
  );
}

/* ---------------- TV sign-in ---------------- */
export function TvLink() {
  const { refresh, toast } = useAccountCtx();
  const [code, setCode] = useState(() => (typeof window === "undefined" ? "" : formatTvCode(new URLSearchParams(location.search).get("code") ?? "")));
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  return (
    <div className="space-y-6">
      <PageTitle title="Sign in on your TV" back="/account" sub="Open MyFlix on your Smart TV, choose Sign in with phone, and enter the 8-digit code shown on the TV." />
      <Card>
        {done ? (
          <div className="py-6 text-center">
            <p className="text-2xl font-bold">Your TV is signed in</p>
            <p className="mt-2 text-neutral-600">It now appears under Devices. Grab the remote and enjoy.</p>
            <Link href="/account/devices" className="mt-4 inline-block font-semibold text-brand">View devices</Link>
          </div>
        ) : (
          <div className="max-w-md">
            <input
              value={code}
              onChange={(e) => setCode(formatTvCode(e.target.value))}
              inputMode="numeric"
              placeholder="1234 5678"
              aria-label="TV code"
              className="h-14 w-full rounded border border-neutral-400 px-4 text-center font-mono text-3xl tracking-[0.3em] outline-none focus:ring-2 focus:ring-neutral-900"
            />
            {err && <p className="mt-2 text-sm text-danger">{err}</p>}
            <PrimaryButton
              className="mt-4"
              onClick={async () => {
                setErr("");
                const r = await approveTvCode(code);
                if (!r.ok) return setErr(r.error);
                refresh();
                setDone(true);
                toast("TV signed in.");
              }}
            >
              Sign in TV
            </PrimaryButton>
            <p className="mt-4 text-sm text-neutral-500">
              No Smart TV app yet? Open <Link href="/tv" target="_blank" className="font-semibold text-brand hover:underline">MyFlix for TV</Link> on your TV&apos;s web browser.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}

export function PosterThumb({ id }: { id: string }) {
  const t = byId(id);
  if (!t) return null;
  return <Image src={img(t.image, 80, 120)} alt="" width={40} height={60} className="rounded object-cover" />;
}
