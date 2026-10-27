"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge, Button, Card, CardTitle, PageHeader, statusTone } from "@/components/ui";
import { date, img } from "@/lib/format";
import { useDb } from "@/lib/store";

export default function CalendarPage() {
  const titles = useDb((d) => d.titles);
  const campaigns = useDb((d) => d.campaigns);
  const [month, setMonth] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const start = new Date(month);
  start.setDate(1 - ((start.getDay() + 6) % 7)); // Monday first
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const releases = titles.filter((t) => t.releaseAt && t.status !== "archived");
  const leaving = titles.filter((t) => t.expiresAt);
  const upcoming = releases.filter((t) => new Date(t.releaseAt!).getTime() > Date.now()).sort((a, b) => a.releaseAt!.localeCompare(b.releaseAt!));

  return (
    <div className="space-y-5">
      <PageHeader title="Release Calendar" sub="Premieres, campaigns and titles leaving MyFlix." actions={<Link href="/content/edit" className="inline-flex h-10 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-hover">Schedule a title</Link>} />
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">{month.toLocaleDateString("en-NG", { month: "long", year: "numeric" })}</h3>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeft size={16} /></Button>
              <Button size="sm" variant="outline" onClick={() => { const n = new Date(); setMonth(new Date(n.getFullYear(), n.getMonth(), 1)); }}>Today</Button>
              <Button size="sm" variant="ghost" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month"><ChevronRight size={16} /></Button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d) => {
              const rel = releases.filter((t) => same(new Date(t.releaseAt!), d));
              const out = leaving.filter((t) => same(new Date(t.expiresAt!), d));
              const camp = campaigns.filter((c) => (c.scheduledAt || c.sentAt) && same(new Date((c.scheduledAt || c.sentAt)!), d));
              const inMonth = d.getMonth() === month.getMonth();
              return (
                <div key={d.toISOString()} className={`min-h-24 rounded-xl p-1.5 text-left ${inMonth ? "bg-white/50 dark:bg-white/5" : "opacity-40"} ${same(d, new Date()) ? "ring-2 ring-brand" : ""}`}>
                  <p className="text-xs font-semibold">{d.getDate()}</p>
                  <div className="mt-1 space-y-1">
                    {rel.map((t) => <Link key={t.id} href={`/content/edit?id=${t.id}`} className="block truncate rounded bg-brand/15 px-1 text-[10px] font-semibold text-brand dark:text-brand-bright">▶ {t.title}</Link>)}
                    {out.map((t) => <Link key={t.id} href={`/content/edit?id=${t.id}`} className="block truncate rounded bg-rose-500/15 px-1 text-[10px] font-semibold text-rose-600">✕ {t.title}</Link>)}
                    {camp.map((c) => <Link key={c.id} href="/campaigns" className="block truncate rounded bg-sky-500/15 px-1 text-[10px] font-semibold text-sky-600">✉ {c.name}</Link>)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
            <span><span className="text-brand">▶</span> Release</span>
            <span><span className="text-rose-600">✕</span> Leaving MyFlix</span>
            <span><span className="text-sky-600">✉</span> Campaign</span>
          </div>
        </Card>
        <Card>
          <CardTitle title="Coming up" sub={`${upcoming.length} scheduled premieres`} />
          <ul className="space-y-3">
            {upcoming.map((t) => (
              <li key={t.id}>
                <Link href={`/content/edit?id=${t.id}`} className="flex items-center gap-3 rounded-xl p-1.5 hover:bg-white/60 dark:hover:bg-white/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img(t.image, 80, 120)} alt="" className="h-14 w-10 rounded-lg object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{t.title}</span>
                    <span className="text-xs text-slate-500">{date(t.releaseAt)}</span>
                  </span>
                  <Badge tone={statusTone(t.status)}>{t.status}</Badge>
                </Link>
              </li>
            ))}
            {upcoming.length === 0 && <li className="text-sm text-slate-500">Nothing scheduled.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}
