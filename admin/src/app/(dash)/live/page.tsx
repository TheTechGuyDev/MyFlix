"use client";

import { MonitorPlay, Radio, Square, Tv } from "lucide-react";
import { Badge, Button, Card, CardTitle, Empty, PageHeader, Stat, Table, Td, useToast } from "@/components/ui";
import { ago, img, num } from "@/lib/format";
import { useLocal, useNow, writeLocal, readLocal, type LiveStream, type TvCode } from "@/lib/local";
import { log, useDb } from "@/lib/store";

const STALE = 30000;

export default function LivePage() {
  const toast = useToast();
  const now = useNow(3000);
  const live = useLocal<Record<string, LiveStream>>("myflix.live", {}, 3000);
  const codes = useLocal<Record<string, TvCode>>("myflix.tv.pending", {}, 3000);
  const titles = useDb((d) => d.titles);
  const plans = useDb((d) => d.plans);
  const settings = useDb((d) => d.settings);

  const streams = Object.values(live).filter((s) => now - s.beat < STALE && !s.stoppedBy).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const accounts = new Set(streams.map((s) => s.email));
  const tvs = Object.values(codes).sort((a, b) => b.createdAt - a.createdAt).slice(0, 12);
  const byTitle = streams.reduce<Record<string, number>>((m, s) => ({ ...m, [s.title]: (m[s.title] ?? 0) + 1 }), {});

  const stop = (s: LiveStream) => {
    const all = readLocal<Record<string, LiveStream>>("myflix.live", {});
    if (all[s.id]) all[s.id] = { ...all[s.id], stoppedBy: "admin" };
    writeLocal("myflix.live", all);
    log("Stopped a stream", `${s.email} · ${s.title}`);
    toast("Stream stopped. The member sees a 'Playback stopped' message.");
  };

  const overLimit = (email: string) => {
    const users = readLocal<Record<string, { planId?: string }>>("myflix.users", {});
    const screens = plans.find((p) => p.id === users[email]?.planId)?.screens ?? 1;
    return streams.filter((s) => s.email === email).length > screens;
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Live Now" sub="Who is watching right now across the website, apps and TVs. Updates every few seconds." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Streams playing" value={num(streams.length)} icon={<Radio size={18} />} />
        <Stat label="Accounts watching" value={num(accounts.size)} icon={<MonitorPlay size={18} />} />
        <Stat label="On Smart TVs" value={num(streams.filter((s) => /TV/i.test(s.device)).length)} icon={<Tv size={18} />} />
        <Stat label="Screen limits" value={settings.streamLimitEnforced ? "Enforced" : "Off"} hint="Change in Settings" />
      </div>

      <Card pad={false}>
        <div className="p-5 pb-0"><CardTitle title="Streams" sub="A stream counts as live for 30 seconds after its last heartbeat" /></div>
        {streams.length === 0 ? (
          <Empty title="Nobody is watching right now" sub="Open a title on the MyFlix site in another tab and it appears here within seconds." />
        ) : (
          <Table head={["Title", "Member", "Device", "Started", ""]} minW={760}>
            {streams.map((s) => {
              const t = titles.find((x) => x.id === s.titleId);
              return (
                <tr key={s.id} className="hover:bg-white/40 dark:hover:bg-white/5">
                  <Td>
                    <span className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {t && <img src={img(t.image, 96, 54)} alt="" className="h-9 w-16 rounded object-cover" />}
                      <span className="font-semibold">{s.title}</span>
                    </span>
                  </Td>
                  <Td>
                    <span className="block">{s.profile}</span>
                    <span className="text-xs text-slate-500">{s.email}</span>
                    {overLimit(s.email) && <Badge tone="bad">Over screen limit</Badge>}
                  </Td>
                  <Td>{s.device}</Td>
                  <Td>{ago(s.startedAt)}</Td>
                  <Td><Button size="sm" variant="outline" icon={<Square size={12} />} onClick={() => stop(s)}>Stop</Button></Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardTitle title="Most watched right now" />
          {Object.keys(byTitle).length === 0 ? (
            <p className="text-sm text-slate-500">No live viewing yet.</p>
          ) : (
            <ul className="space-y-2">
              {Object.entries(byTitle).sort((a, b) => b[1] - a[1]).map(([title, n]) => (
                <li key={title} className="flex items-center justify-between rounded-lg bg-slate-900/5 px-3 py-2 text-sm dark:bg-white/5">
                  <span className="font-medium">{title}</span>
                  <Badge tone="brand">{n} watching</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardTitle title="TV sign-in codes" sub="Codes shown on MyFlix for TV and whether a phone approved them" />
          {tvs.length === 0 ? (
            <p className="text-sm text-slate-500">No TV codes yet. Open /tv on the site to create one.</p>
          ) : (
            <ul className="divide-y divide-slate-200/70 text-sm dark:divide-white/10">
              {tvs.map((c) => (
                <li key={c.code} className="flex items-center justify-between py-2">
                  <span className="font-mono">{c.code.slice(0, 4)} {c.code.slice(4)}</span>
                  {c.paired ? (
                    <span className="text-right"><Badge tone="ok">Paired</Badge><span className="block text-xs text-slate-500">{c.paired.email} · {ago(c.paired.at)}</span></span>
                  ) : c.exp < now ? (
                    <Badge tone="muted">Expired</Badge>
                  ) : (
                    <Badge tone="warn">Waiting</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
