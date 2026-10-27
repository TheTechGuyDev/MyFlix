import type { Db } from "./store";
import { allMembers } from "./store";

const DAY = 864e5;

export function monthKeys(n = 12) {
  const out: { key: string; label: string; start: Date; end: Date }[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const s = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const e = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    out.push({ key: `${s.getFullYear()}-${s.getMonth()}`, label: s.toLocaleDateString("en-NG", { month: "short" }), start: s, end: e });
  }
  return out;
}

export function overview(d: Db) {
  const members = allMembers(d);
  const active = members.filter((m) => m.status === "active" || m.status === "trial");
  const price = (id: string) => d.plans.find((p) => p.id === id)?.price ?? 0;
  const mrr = active.reduce((a, m) => a + price(m.planId), 0);
  const now = Date.now();
  const inRange = (iso: string, from: number, to: number) => {
    const t = new Date(iso).getTime();
    return t >= from && t < to;
  };
  const ok = d.txns.filter((t) => t.status === "success");
  const rev30 = ok.filter((t) => inRange(t.at, now - 30 * DAY, now)).reduce((a, t) => a + t.amount, 0);
  const revPrev = ok.filter((t) => inRange(t.at, now - 60 * DAY, now - 30 * DAY)).reduce((a, t) => a + t.amount, 0);
  const new30 = members.filter((m) => inRange(m.joinedAt, now - 30 * DAY, now)).length;
  const newPrev = members.filter((m) => inRange(m.joinedAt, now - 60 * DAY, now - 30 * DAY)).length;
  const cancelled = members.filter((m) => m.status === "cancelled").length;
  const churn = members.length ? (cancelled / members.length) * 100 * (30 / 365) * 4 : 0;
  const watchHours = d.titles.reduce((a, t) => a + t.stats.watchHours, 0);
  const failed30 = d.txns.filter((t) => t.status === "failed" && inRange(t.at, now - 30 * DAY, now));

  const months = monthKeys(12).map((m) => ({
    label: m.label,
    revenue: ok.filter((t) => inRange(t.at, m.start.getTime(), m.end.getTime())).reduce((a, t) => a + t.amount, 0),
    signups: members.filter((x) => inRange(x.joinedAt, m.start.getTime(), m.end.getTime())).length,
    cancels: Math.round(members.filter((x) => x.status === "cancelled" && inRange(x.joinedAt, m.start.getTime() - 60 * DAY, m.end.getTime() - 60 * DAY)).length * 0.8),
  }));

  const planMix = d.plans.map((p) => ({ name: p.name, id: p.id, value: active.filter((m) => m.planId === p.id).length, price: p.price }));
  const methodMix = (["card", "transfer", "ussd"] as const).map((k) => ({ name: k === "card" ? "Card" : k === "transfer" ? "Transfer" : "USSD", value: active.filter((m) => m.method === k).length }));
  const byState = Object.entries(members.reduce<Record<string, number>>((a, m) => ((a[m.state] = (a[m.state] ?? 0) + 1), a), {}))
    .map(([state, count]) => ({ state, count }))
    .sort((a, b) => b.count - a.count);

  const topTitles = [...d.titles].filter((t) => t.status === "published").sort((a, b) => b.stats.views - a.stats.views).slice(0, 8);
  const expiring = d.titles.filter((t) => t.licence?.expires && new Date(t.licence.expires).getTime() - now < 60 * DAY);

  return {
    members, active, mrr, rev30, revDelta: revPrev ? ((rev30 - revPrev) / revPrev) * 100 : 0, new30, newDelta: newPrev ? ((new30 - newPrev) / newPrev) * 100 : 0,
    churn, watchHours, failed30, months, planMix, methodMix, byState, topTitles, expiring,
    arpu: active.length ? mrr / active.length : 0,
  };
}

/** Hourly viewing pattern (Nigeria evenings peak) for the heatmap. */
export function hourly() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return days.map((day, di) => ({
    day,
    hours: Array.from({ length: 24 }, (_, h) => {
      const evening = Math.exp(-((h - 21) ** 2) / 8);
      const lunch = 0.35 * Math.exp(-((h - 13) ** 2) / 4);
      const weekend = di >= 5 ? 1.35 : di === 4 ? 1.15 : 1;
      const late = h < 2 ? 0.5 : 0;
      return Math.round((evening + lunch + late + 0.05) * weekend * 100);
    }),
  }));
}

export function deviceSplit() {
  return [
    { name: "Android phone", value: 46 },
    { name: "Smart TV", value: 21 },
    { name: "Web", value: 15 },
    { name: "iPhone", value: 12 },
    { name: "Tablet", value: 6 },
  ];
}

export function qualitySplit() {
  return [
    { name: "Data Saver (480p)", value: 31 },
    { name: "HD (720p)", value: 29 },
    { name: "Full HD (1080p)", value: 27 },
    { name: "4K", value: 13 },
  ];
}

export function cohorts(d: Db) {
  const members = allMembers(d);
  return monthKeys(6).map((m, i) => {
    const joined = members.filter((x) => {
      const t = new Date(x.joinedAt).getTime();
      return t >= m.start.getTime() && t < m.end.getTime();
    });
    const base = joined.length || 1;
    const retained = joined.filter((x) => x.status === "active").length / base;
    return {
      label: m.label,
      size: joined.length,
      months: Array.from({ length: 6 - i }, (_, k) => Math.round(100 * Math.max(retained, 1 - (k * (1 - retained)) / Math.max(1, 5 - i)))),
    };
  });
}
