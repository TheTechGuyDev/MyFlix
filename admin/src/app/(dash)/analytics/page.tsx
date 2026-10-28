"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardTitle, PageHeader, Select, Stat, Table, Td } from "@/components/ui";
import { COLORS, chartTip, img, naira, nairaShort, num } from "@/lib/format";
import { cohorts, deviceSplit, hourly, overview, qualitySplit } from "@/lib/metrics";
import { refreshStats, useDb } from "@/lib/store";

export default function AnalyticsPage() {
  const d = useDb((x) => x);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  // Other pages show 30-day figures, so put the period back when leaving
  useEffect(() => () => void refreshStats(30), []);
  if (!d.ready) return null;
  const o = overview(d);
  const heat = hourly(d);
  const coh = cohorts(d);
  const maxHeat = Math.max(1, ...heat.flatMap((h) => h.hours));
  const anyHeat = heat.some((h) => h.hours.some((v) => v > 0));
  const plays = new Map(o.topTitles.map((t) => [t.id, t.plays]));
  const genres = Object.entries(
    o.topTitles.reduce<Record<string, number>>((a, t) => {
      t.genres.forEach((g) => (a[g] = (a[g] ?? 0) + t.plays));
      return a;
    }, {}),
  )
    .map(([genre, n]) => ({ genre, plays: n }))
    .sort((a, b) => b.plays - a.plays)
    .slice(0, 8);
  const totalPlays = o.topTitles.reduce((a, t) => a + t.plays, 0);
  const originals = o.topTitles.filter((t) => t.original).reduce((a, t) => a + t.plays, 0);
  const watch = (d.stats?.watch_daily ?? []).map((x) => ({ day: new Date(x.day).toLocaleDateString("en-NG", { day: "numeric", month: "short" }), hours: x.hours }));
  const revenue = (d.stats?.revenue_daily ?? []).map((x) => ({ day: new Date(x.day).toLocaleDateString("en-NG", { day: "numeric", month: "short" }), amount: x.amount }));
  const licensed = d.titles.filter((t) => t.licence?.cost);
  const pickDays = async (n: number) => {
    setDays(n);
    setLoading(true);
    await refreshStats(n);
    setLoading(false);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Analytics"
        sub="Audience, engagement and revenue, from real viewing and payment records."
        actions={
          <Select value={days} onChange={(e) => pickDays(Number(e.target.value))} aria-label="Period" className="!w-40" disabled={loading}>
            {[7, 30, 90, 365].map((n) => <option key={n} value={n}>Last {n} days</option>)}
          </Select>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="ARPU" value={naira(o.arpu)} hint="Monthly revenue per active member" />
        <Stat label={`Revenue (${days} days)`} value={nairaShort(o.rev30)} delta={o.revDelta} />
        <Stat label={`Watch hours (${days} days)`} value={num(o.watchHours)} />
        <Stat label="Originals share" value={totalPlays ? `${Math.round((originals / totalPlays) * 100)}%` : "-"} hint="Of plays among top titles" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle title="When Nigeria watches" sub="Plays by day and hour (WAT)" />
          {!anyHeat ? (
            <p className="py-10 text-center text-sm text-slate-500">Viewing patterns appear once members start watching.</p>
          ) : (
            <div className="thin-scroll overflow-x-auto">
              <div className="min-w-[620px]">
                <div className="ml-10 grid text-[9px] text-slate-500" style={{ gridTemplateColumns: "repeat(24, minmax(0,1fr))" }}>
                  {Array.from({ length: 24 }, (_, h) => <span key={h} className="text-center">{h % 3 === 0 ? `${h}h` : ""}</span>)}
                </div>
                {heat.map((row) => (
                  <div key={row.day} className="flex items-center gap-1 py-0.5">
                    <span className="w-9 text-xs text-slate-500">{row.day}</span>
                    <div className="grid flex-1 gap-0.5" style={{ gridTemplateColumns: "repeat(24, minmax(0,1fr))" }}>
                      {row.hours.map((v, h) => <span key={h} title={`${row.day} ${h}:00 · ${v} plays`} className="aspect-square rounded-sm" style={{ background: `rgba(13,155,95,${0.06 + (v / maxHeat) * 0.94})` }} />)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
        <Card>
          <CardTitle title="Plays by genre" sub={`Last ${days} days`} />
          {genres.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">No plays yet.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={genres} layout="vertical" margin={{ left: 20 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="genre" tickLine={false} axisLine={false} fontSize={12} width={90} />
                  <Tooltip {...chartTip} formatter={(v) => num(Number(v))} />
                  <Bar dataKey="plays" fill="#0d9b5f" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardTitle title="Devices" sub={`Active in the last ${days} days`} />
          <Donut data={deviceSplit(d)} />
        </Card>
        <Card>
          <CardTitle title="Quality cap" sub="Members by plan resolution" />
          <Donut data={qualitySplit(d)} />
        </Card>
        <Card>
          <CardTitle title="Payment methods" sub={`Successful payments, last ${days} days`} />
          <Donut data={o.methodMix} />
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle title="Daily watch hours" sub={`Last ${days} days`} />
          <div className="h-56">
            <ResponsiveContainer>
              <AreaChart data={watch} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.08} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} />
                <Tooltip {...chartTip} />
                <Area type="monotone" dataKey="hours" stroke="#0d9b5f" fill="#0d9b5f" fillOpacity={0.2} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardTitle title="Daily revenue" sub={`Last ${days} days`} />
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={revenue} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.08} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickFormatter={(v) => nairaShort(v)} tickLine={false} axisLine={false} fontSize={11} width={55} />
                <Tooltip {...chartTip} formatter={(v) => naira(Number(v))} />
                <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle title="Member growth" sub="Sign-ups and cancellations per month" />
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={o.months} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.08} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
                <Tooltip {...chartTip} />
                <Line type="monotone" dataKey="signups" name="Sign-ups" stroke="#0d9b5f" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="cancels" name="Cancellations" stroke="#e5484d" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardTitle title="Sign-up cohorts" sub="Of each month's sign-ups: who paid, and who still has access today" />
          <Table head={["Month", "Sign-ups", "Paid", "Still watching"]} minW={380}>
            {coh.map((c) => (
              <tr key={c.label}>
                <Td className="font-semibold">{c.label}</Td>
                <Td>{c.size}</Td>
                <Td>{c.size ? `${c.paidPct}%` : "-"}</Td>
                <Td>{c.size ? <span className="rounded px-2 py-0.5 font-semibold" style={{ background: `rgba(13,155,95,${c.retainedPct / 130})` }}>{c.retainedPct}%</span> : "-"}</Td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card pad={false}>
          <div className="p-5 pb-0"><CardTitle title="Most played" sub={`Last ${days} days`} /></div>
          {o.topTitles.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-slate-500">No plays yet.</p>
          ) : (
            <Table head={["Title", "Plays", "All-time views"]} minW={420}>
              {o.topTitles.slice(0, 10).map((t) => (
                <tr key={t.id}>
                  <Td>
                    <span className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img(t.image, 60, 90)} alt="" className="h-9 w-6 rounded object-cover" />
                      <span className="font-semibold">{t.title}</span>
                    </span>
                  </Td>
                  <Td>{num(t.plays)}</Td>
                  <Td>{num(t.stats.views)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
        <Card pad={false}>
          <div className="p-5 pb-0"><CardTitle title="Licensed content" sub="Licence cost against plays" /></div>
          {licensed.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-slate-500">Add a licence cost under a title&apos;s Availability &amp; Rights tab to track it here.</p>
          ) : (
            <Table head={["Title", "Licence cost", "All-time views", "Cost per view"]} minW={460}>
              {licensed
                .sort((a, b) => b.stats.views - a.stats.views)
                .slice(0, 10)
                .map((t) => (
                  <tr key={t.id}>
                    <Td className="font-semibold">{t.title}</Td>
                    <Td>{nairaShort(t.licence!.cost!)}</Td>
                    <Td>{num(t.stats.views)}{plays.get(t.id) ? <span className="text-xs text-slate-500"> ({num(plays.get(t.id)!)} recent)</span> : null}</Td>
                    <Td>{t.stats.views ? naira(t.licence!.cost! / t.stats.views) : "-"}</Td>
                  </tr>
                ))}
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}

function Donut({ data }: { data: { name: string; value: number }[] }) {
  if (!data.length || data.every((x) => !x.value)) return <p className="py-10 text-center text-sm text-slate-500">No data yet.</p>;
  const sum = data.reduce((a, x) => a + x.value, 0) || 1;
  return (
    <>
      <div className="h-40">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={42} outerRadius={65} paddingAngle={3} stroke="none">
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip {...chartTip} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 space-y-1 text-sm">
        {data.map((x, i) => (
          <li key={x.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="flex-1">{x.name}</span>
            <span className="font-semibold">{((x.value / sum) * 100).toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </>
  );
}
