"use client";

import { MonitorPlay, Radio, Square, Tv } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, CardTitle, Empty, PageHeader, Stat, Table, Td, useToast } from "@/components/ui";
import { ago, img, num } from "@/lib/format";
import { useDb } from "@/lib/store";
import { sb } from "@/lib/supabase";

type Stream = { id: string; account_id: string; email: string; profile: string | null; device: string | null; title_id: string | null; title: string | null; started_at: string; beat_at: string; screens: number };
type TvCode = { code: string; created_at: string; expires_at: string; approved_email: string | null; approved_at: string | null; consumed_at: string | null };

export default function LivePage() {
  const toast = useToast();
  const titles = useDb((d) => d.titles);
  const settings = useDb((d) => d.settings);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [codes, setCodes] = useState<TvCode[]>([]);
  const [err, setErr] = useState("");
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await sb().rpc("admin_live");
    if (error) return setErr(error.message);
    setErr("");
    setStreams((data?.streams as Stream[]) ?? []);
    setCodes((data?.tv_codes as TvCode[]) ?? []);
    setLoaded(true);
  }, []);

  // Refresh every 5 seconds while the page is open and visible
  useEffect(() => {
    void load();
    const id = setInterval(() => document.visibilityState === "visible" && void load(), 5000);
    return () => clearInterval(id);
  }, [load]);

  const accounts = new Set(streams.map((s) => s.account_id));
  const byTitle = streams.reduce<Record<string, number>>((m, s) => ({ ...m, [s.title ?? "Unknown"]: (m[s.title ?? "Unknown"] ?? 0) + 1 }), {});
  const perAccount = streams.reduce<Record<string, number>>((m, s) => ({ ...m, [s.account_id]: (m[s.account_id] ?? 0) + 1 }), {});
  const now = Date.now();

  const stop = async (s: Stream) => {
    if (!confirm(`Stop ${s.profile ?? s.email} watching ${s.title ?? "this title"}?`)) return;
    const { error } = await sb().rpc("admin_stop_stream", { p_id: s.id });
    if (error) return toast(error.message, "bad");
    setStreams((x) => x.filter((y) => y.id !== s.id));
    toast("Stream stopped. The member sees a 'Playback stopped' message.");
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Live Now" sub="Who is watching right now across the website, apps and TVs. Updates every 5 seconds." />
      {err && <Card><p className="text-sm text-danger">Couldn&apos;t load live data: {err}</p></Card>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Streams playing" value={num(streams.length)} icon={<Radio size={18} />} />
        <Stat label="Accounts watching" value={num(accounts.size)} icon={<MonitorPlay size={18} />} />
        <Stat label="On Smart TVs" value={num(streams.filter((s) => /TV/i.test(s.device ?? "")).length)} icon={<Tv size={18} />} />
        <Stat label="Screen limits" value={settings.streamLimitEnforced ? "Enforced" : "Off"} hint="Change in Settings" />
      </div>

      <Card pad={false}>
        <div className="p-5 pb-0"><CardTitle title="Streams" sub="A stream counts as live for 30 seconds after its last heartbeat" /></div>
        {streams.length === 0 ? (
          <Empty title={loaded ? "Nobody is watching right now" : "Loading…"} sub="Streams show here within seconds of a member pressing play." />
        ) : (
          <Table head={["Title", "Member", "Device", "Started", ""]} minW={760}>
            {streams.map((s) => {
              const t = titles.find((x) => x.id === s.title_id);
              return (
                <tr key={s.id} className="hover:bg-white/40 dark:hover:bg-white/5">
                  <Td>
                    <span className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {t && <img src={img(t.image, 96, 54)} alt="" className="h-9 w-16 rounded object-cover" />}
                      <span className="font-semibold">{s.title ?? "Unknown title"}</span>
                    </span>
                  </Td>
                  <Td>
                    <span className="block">{s.profile ?? "-"}</span>
                    <span className="text-xs text-slate-500">{s.email}</span>
                    {(perAccount[s.account_id] ?? 0) > s.screens && <Badge tone="bad">Over screen limit</Badge>}
                  </Td>
                  <Td>{s.device ?? "-"}</Td>
                  <Td>{ago(s.started_at)}</Td>
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
          <CardTitle title="TV sign-in codes" sub="Recent codes shown on TVs and whether a phone approved them" />
          {codes.length === 0 ? (
            <p className="text-sm text-slate-500">No TV codes yet.</p>
          ) : (
            <ul className="divide-y divide-slate-200/70 text-sm dark:divide-white/10">
              {codes.map((c) => (
                <li key={c.code} className="flex items-center justify-between py-2">
                  <span className="font-mono">{c.code.slice(0, 4)} {c.code.slice(4)}</span>
                  {c.approved_at ? (
                    <span className="text-right">
                      <Badge tone="ok">{c.consumed_at ? "Signed in" : "Approved"}</Badge>
                      <span className="block text-xs text-slate-500">{c.approved_email} · {ago(c.approved_at)}</span>
                    </span>
                  ) : new Date(c.expires_at).getTime() < now ? (
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
