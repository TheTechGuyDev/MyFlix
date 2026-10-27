"use client";

import { AlertTriangle, Clock, CreditCard, Film, TrendingUp, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, Card, CardTitle, PageHeader, Stat, Table, Td } from "@/components/ui";
import { ago, img, naira, nairaShort, num, pct, videoState } from "@/lib/format";
import { overview } from "@/lib/metrics";
import { currentStaff, useDb } from "@/lib/store";

const COLORS = ["#0d9b5f", "#3b82f6", "#f5a524", "#a855f7", "#e5484d", "#14b8a6"];
const tip = { contentStyle: { borderRadius: 12, border: "none", boxShadow: "0 8px 30px rgba(0,0,0,.12)", fontSize: 12 } };

export default function OverviewPage() {
  const d = useDb((x) => x);
  const staff = currentStaff(d);
  if (!d.titles.length) return null;
  const o = overview(d);
  const processing = d.titles.filter((t) => t.video && videoState(t.video).tone === "warn");
  const openTickets = d.tickets.filter((t) => t.status !== "resolved");
  const hour = new Date().getHours();

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Good ${hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}, ${staff?.name.split(" ")[0] ?? ""}`}
        sub="Here's what's happening on MyFlix today."
        actions={
          <>
            <Link href="/content/edit" className="inline-flex h-10 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-white shadow-sm shadow-brand/30 hover:bg-brand-hover">+ Add title</Link>
            <Link href="/analytics" className="inline-flex h-10 items-center rounded-xl border border-slate-300/80 bg-white/50 px-4 text-sm font-semibold hover:bg-white dark:border-white/15 dark:bg-white/5">Full analytics</Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Active members" value={num(o.active.length)} delta={o.newDelta} icon={<Users size={20} />} />
        <Stat label="Monthly recurring revenue" value={nairaShort(o.mrr)} hint={`ARPU ${naira(o.arpu)}`} icon={<Wallet size={20} />} />
        <Stat label="Revenue (30 days)" value={nairaShort(o.rev30)} delta={o.revDelta} icon={<TrendingUp size={20} />} />
        <Stat label="Watch hours" value={num(o.watchHours)} hint={`Churn ${pct(o.churn)} / month`} icon={<Clock size={20} />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardTitle title="Revenue" sub="Successful payments, last 12 months" right={<Badge tone="brand">{nairaShort(o.months.reduce((a, m) => a + m.revenue, 0))} total</Badge>} />
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={o.months} margin={{ left: -10, right: 8 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0d9b5f" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#0d9b5f" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.08} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickFormatter={(v) => nairaShort(v)} tickLine={false} axisLine={false} fontSize={11} width={60} />
                <Tooltip {...tip} formatter={(v) => naira(Number(v))} />
                <Area type="monotone" dataKey="revenue" stroke="#0d9b5f" strokeWidth={2.5} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardTitle title="Plan mix" sub="Active members by plan" />
          <div className="h-44">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={o.planMix} dataKey="value" nameKey="name" innerRadius={50} outerRadius={75} paddingAngle={3} stroke="none">
                  {o.planMix.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip {...tip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 space-y-1.5 text-sm">
            {o.planMix.map((p, i) => (
              <li key={p.id} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i] }} />
                <span className="flex-1">{p.name}</span>
                <span className="font-semibold">{p.value}</span>
                <span className="w-20 text-right text-xs text-slate-500">{nairaShort(p.value * p.price)}/mo</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardTitle title="Sign-ups vs cancellations" sub="Last 12 months" />
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={o.months} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.08} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} />
                <Tooltip {...tip} />
                <Bar dataKey="signups" name="Sign-ups" fill="#0d9b5f" radius={[6, 6, 0, 0]} />
                <Bar dataKey="cancels" name="Cancellations" fill="#e5484d" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardTitle title="Needs attention" />
          <ul className="space-y-3 text-sm">
            <Alert href="/payments?status=failed" icon={<CreditCard size={16} />} tone="bad" text={`${o.failed30.length} failed payments in the last 30 days`} />
            <Alert href="/support" icon={<AlertTriangle size={16} />} tone="warn" text={`${openTickets.length} open support tickets`} />
            <Alert href="/content?licence=expiring" icon={<Film size={16} />} tone="warn" text={`${o.expiring.length} licences expire within 60 days`} />
            <Alert href="/uploads" icon={<Clock size={16} />} tone="info" text={`${processing.length} videos processing`} />
          </ul>
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Top states</p>
            {o.byState.slice(0, 5).map((s) => (
              <div key={s.state} className="mb-1.5 flex items-center gap-2 text-sm">
                <span className="w-24 truncate">{s.state}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-900/10 dark:bg-white/10">
                  <span className="block h-full rounded-full bg-brand" style={{ width: `${(s.count / o.byState[0].count) * 100}%` }} />
                </span>
                <span className="w-8 text-right text-xs font-semibold">{s.count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" pad={false}>
          <div className="p-5 pb-0"><CardTitle title="Top titles" sub="By total views" right={<Link href="/content" className="text-sm font-semibold text-brand">View library</Link>} /></div>
          <Table head={["Title", "Type", "Views", "Watch hours", "Completion"]} minW={560}>
            {o.topTitles.map((t, i) => (
              <tr key={t.id} className="hover:bg-white/40 dark:hover:bg-white/5">
                <Td>
                  <Link href={`/content/edit?id=${t.id}`} className="flex items-center gap-3">
                    <span className="w-5 text-xs font-bold text-slate-400">{i + 1}</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img(t.image, 80, 120)} alt="" className="h-10 w-7 rounded object-cover" />
                    <span className="font-semibold">{t.title}</span>
                  </Link>
                </Td>
                <Td><Badge>{t.type}</Badge></Td>
                <Td>{num(t.stats.views)}</Td>
                <Td>{num(t.stats.watchHours)}</Td>
                <Td>{t.stats.completion}%</Td>
              </tr>
            ))}
          </Table>
        </Card>
        <Card>
          <CardTitle title="Recent activity" right={<Link href="/audit" className="text-sm font-semibold text-brand">Audit log</Link>} />
          <ul className="space-y-3">
            {d.audit.slice(0, 7).map((a) => (
              <li key={a.id} className="text-sm">
                <span className="font-semibold">{a.staff}</span> <span className="text-slate-500">{a.action.toLowerCase()}</span> <span className="font-medium">{a.target}</span>
                <span className="block text-xs text-slate-400">{ago(a.at)}</span>
              </li>
            ))}
            {d.audit.length === 0 && <li className="text-sm text-slate-500">Activity from your team shows up here.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Alert({ href, icon, text, tone }: { href: string; icon: React.ReactNode; text: string; tone: "bad" | "warn" | "info" }) {
  const c = tone === "bad" ? "bg-rose-500/10 text-rose-600" : tone === "warn" ? "bg-amber-500/10 text-amber-600" : "bg-sky-500/10 text-sky-600";
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 rounded-xl p-2 hover:bg-white/60 dark:hover:bg-white/5">
        <span className={`rounded-lg p-2 ${c}`}>{icon}</span>
        <span className="flex-1">{text}</span>
      </Link>
    </li>
  );
}
