"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardTitle, PageHeader, Stat, Table, Td } from "@/components/ui";
import { COLORS, chartTip, img, naira, nairaShort, num } from "@/lib/format";
import { cohorts, deviceSplit, hourly, overview, qualitySplit } from "@/lib/metrics";
import { useDb } from "@/lib/store";

export default function AnalyticsPage() {
  const d = useDb((x) => x);
  if (!d.titles.length) return null;
  const o = overview(d);
  const heat = hourly();
  const coh = cohorts(d);
  const maxHeat = Math.max(...heat.flatMap((h) => h.hours));
  const genres = Object.entries(
    d.titles.reduce<Record<string, number>>((a, t) => {
      t.genres.forEach((g) => (a[g] = (a[g] ?? 0) + t.stats.watchHours));
      return a;
    }, {}),
  )
    .map(([genre, hours]) => ({ genre, hours }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 8);
  const titles = [...d.titles].filter((t) => t.stats.views > 0);
  const completion = [...titles].sort((a, b) => b.stats.completion - a.stats.completion);
  const originals = titles.filter((t) => t.original).reduce((a, t) => a + t.stats.watchHours, 0);
  const total = titles.reduce((a, t) => a + t.stats.watchHours, 0) || 1;
  const ltv = o.arpu * (100 / Math.max(1, o.churn));
  const licensed = d.titles.filter((t) => t.licence?.cost);

  return (
    <div className="space-y-5">
      <PageHeader title="Analytics" sub="Audience, engagement, quality of experience and content ROI." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="ARPU" value={naira(o.arpu)} hint="Average revenue per member / month" />
        <Stat label="Lifetime value" value={nairaShort(ltv)} hint={`Churn ${o.churn.toFixed(1)}% / month`} />
        <Stat label="Originals share" value={`${((originals / total) * 100).toFixed(0)}%`} hint="Of all watch hours" />
        <Stat label="Avg completion" value={`${Math.round(titles.reduce((a, t) => a + t.stats.completion, 0) / (titles.length || 1))}%`} hint="Across all titles" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle title="When Nigeria watches" sub="Viewing intensity by day and hour (WAT)" />
          <div className="thin-scroll overflow-x-auto">
            <div className="min-w-[620px]">
              <div className="ml-10 grid text-[9px] text-slate-500" style={{ gridTemplateColumns: "repeat(24, minmax(0,1fr))" }}>
                {Array.from({ length: 24 }, (_, h) => <span key={h} className="text-center">{h % 3 === 0 ? `${h}h` : ""}</span>)}
              </div>
              {heat.map((row) => (
                <div key={row.day} className="flex items-center gap-1 py-0.5">
                  <span className="w-9 text-xs text-slate-500">{row.day}</span>
                  <div className="grid flex-1 gap-0.5" style={{ gridTemplateColumns: "repeat(24, minmax(0,1fr))" }}>
                    {row.hours.map((v, h) => <span key={h} title={`${row.day} ${h}:00 · ${v}`} className="aspect-square rounded-sm" style={{ background: `rgba(13,155,95,${0.08 + (v / maxHeat) * 0.92})` }} />)}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">Peak: 8pm to 11pm, highest on Friday and weekends. Schedule premieres for Friday 7pm.</p>
        </Card>
        <Card>
          <CardTitle title="Watch hours by genre" />
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={genres} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="genre" tickLine={false} axisLine={false} fontSize={12} width={90} />
                <Tooltip {...chartTip} formatter={(v) => num(Number(v))} />
                <Bar dataKey="hours" fill="#0d9b5f" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardTitle title="Devices" sub="Share of streams" />
          <Donut data={deviceSplit()} />
        </Card>
        <Card>
          <CardTitle title="Stream quality" sub="Data Saver is a key Nigeria feature" />
          <Donut data={qualitySplit()} />
        </Card>
        <Card>
          <CardTitle title="Payment methods" sub="Active members" />
          <Donut data={o.methodMix} />
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle title="Member growth" sub="New sign-ups per month" />
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={o.months} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.08} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} />
                <Tooltip {...chartTip} />
                <Line type="monotone" dataKey="signups" stroke="#0d9b5f" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="cancels" stroke="#e5484d" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardTitle title="Retention cohorts" sub="% of each month's sign-ups still subscribed" />
          <div className="thin-scroll overflow-x-auto">
            <table className="w-full min-w-[460px] text-center text-xs">
              <thead>
                <tr className="text-slate-500">
                  <th className="py-1 text-left">Cohort</th>
                  <th>Size</th>
                  {Array.from({ length: 6 }, (_, i) => <th key={i}>M{i}</th>)}
                </tr>
              </thead>
              <tbody>
                {coh.map((c) => (
                  <tr key={c.label}>
                    <td className="py-1 text-left font-semibold">{c.label}</td>
                    <td>{c.size}</td>
                    {Array.from({ length: 6 }, (_, i) => (
                      <td key={i} className="p-0.5">
                        {c.months[i] !== undefined && <span className="block rounded py-1 font-semibold" style={{ background: `rgba(13,155,95,${c.months[i] / 120})`, color: c.months[i] > 60 ? "white" : undefined }}>{c.months[i]}%</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card pad={false}>
          <div className="p-5 pb-0"><CardTitle title="Best completion rates" sub="Titles people finish" /></div>
          <Table head={["Title", "Completion", "Views"]} minW={420}>
            {completion.slice(0, 8).map((t) => (
              <tr key={t.id}>
                <Td>
                  <span className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img(t.image, 60, 90)} alt="" className="h-9 w-6 rounded object-cover" />
                    <span className="font-semibold">{t.title}</span>
                  </span>
                </Td>
                <Td>
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-900/10 dark:bg-white/10"><span className="block h-full bg-brand" style={{ width: `${t.stats.completion}%` }} /></span>
                    {t.stats.completion}%
                  </span>
                </Td>
                <Td>{num(t.stats.views)}</Td>
              </tr>
            ))}
          </Table>
        </Card>
        <Card pad={false}>
          <div className="p-5 pb-0"><CardTitle title="Licensed content ROI" sub="Licence cost against estimated revenue share" /></div>
          <Table head={["Title", "Licence", "Cost/view", "Est. return"]} minW={460}>
            {licensed
              .map((t) => {
                const share = (t.stats.watchHours / total) * o.mrr * 12;
                return { t, share, roi: share / (t.licence!.cost || 1) };
              })
              .sort((a, b) => b.roi - a.roi)
              .slice(0, 8)
              .map(({ t, share, roi }) => (
                <tr key={t.id}>
                  <Td className="font-semibold">{t.title}</Td>
                  <Td>{nairaShort(t.licence!.cost!)}</Td>
                  <Td>{t.stats.views ? naira(t.licence!.cost! / t.stats.views) : "-"}</Td>
                  <Td><span className={roi >= 1 ? "font-semibold text-emerald-600" : "font-semibold text-rose-600"}>{nairaShort(share)} ({(roi * 100).toFixed(0)}%)</span></Td>
                </tr>
              ))}
          </Table>
        </Card>
      </div>

      <Card>
        <CardTitle title="Daily views, top 5 titles" sub="Last 14 days" />
        <div className="h-64">
          <ResponsiveContainer>
            <AreaChart data={Array.from({ length: 14 }, (_, i) => Object.fromEntries([["day", `D${i + 1}`], ...o.topTitles.slice(0, 5).map((t) => [t.title, t.stats.trend[i]])]))}>
              <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} />
              <Tooltip {...chartTip} />
              {o.topTitles.slice(0, 5).map((t, i) => <Area key={t.id} dataKey={t.title} stackId="1" stroke={COLORS[i]} fill={COLORS[i]} fillOpacity={0.35} />)}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

function Donut({ data }: { data: { name: string; value: number }[] }) {
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
