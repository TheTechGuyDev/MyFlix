import type { Db } from "./store";

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

const within = (iso: string | undefined, from: number, to: number) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= from && t < to;
};
const change = (now: number, prev: number) => (prev ? ((now - prev) / prev) * 100 : 0);

/** Headline business numbers, all from real database records (admin_stats + loaded tables). */
export function overview(d: Db) {
  const s = d.stats;
  const now = Date.now();
  const members = d.members;
  const hasAccess = (m: (typeof members)[number]) => m.status !== "suspended" && Boolean(m.paidUntil && new Date(m.paidUntil).getTime() > now);
  const activeCount = s?.members_active ?? members.filter(hasAccess).length;
  const mrr = s?.mrr ?? 0;
  const ok = d.txns.filter((t) => t.status === "success" && t.kind !== "card_update");
  const rev30 = s?.revenue_period ?? ok.filter((t) => within(t.at, now - 30 * DAY, now)).reduce((a, t) => a + t.amount, 0);
  const new30 = s?.signups_period ?? members.filter((m) => within(m.joinedAt, now - 30 * DAY, now)).length;
  const churned = s?.churned_period ?? 0;
  const churn = activeCount + churned ? (churned / (activeCount + churned)) * 100 : 0;

  const months = monthKeys(12).map((m) => ({
    label: m.label,
    revenue: ok.filter((t) => within(t.at, m.start.getTime(), m.end.getTime())).reduce((a, t) => a + t.amount, 0),
    signups: members.filter((x) => within(x.joinedAt, m.start.getTime(), m.end.getTime())).length,
    cancels: members.filter((x) => x.cancelAt && within(x.cancelAt, m.start.getTime(), Math.min(m.end.getTime(), now))).length,
  }));

  const planMix = d.plans.map((p) => ({ name: p.name, id: p.id, value: s?.plan_mix?.[p.id] ?? 0, price: p.price }));
  const channelName: Record<string, string> = { card: "Card", bank_transfer: "Bank transfer", ussd: "USSD", bank: "Bank account", credit: "Credit / promo", mobile_money: "Mobile money" };
  const methodMix = Object.entries(s?.payment_channels ?? {}).map(([k, v]) => ({ name: channelName[k] ?? k, value: v }));
  const byState = Object.entries(s?.by_state ?? {})
    .map(([state, count]) => ({ state, count }))
    .sort((a, b) => b.count - a.count);

  const plays = new Map((s?.top_titles ?? []).map((t) => [t.id, t.plays]));
  const topTitles = d.titles
    .filter((t) => plays.has(t.id))
    .map((t) => ({ ...t, plays: plays.get(t.id) ?? 0 }))
    .sort((a, b) => b.plays - a.plays);
  const expiring = d.titles.filter((t) => t.licence?.expires && new Date(t.licence.expires).getTime() - now < 60 * DAY);

  return {
    activeCount,
    mrr,
    rev30,
    revDelta: change(rev30, s?.revenue_prev ?? 0),
    new30,
    newDelta: change(new30, s?.signups_prev ?? 0),
    churn,
    watchHours: s?.watch_hours_period ?? 0,
    failed30: s?.failed_period ?? d.txns.filter((t) => t.status === "failed" && within(t.at, now - 30 * DAY, now)).length,
    months,
    planMix,
    methodMix,
    byState,
    topTitles,
    expiring,
    arpu: activeCount ? mrr / activeCount : 0,
  };
}

/** Plays by weekday and hour (Nigerian time), from real viewing history. */
export function hourly(d: Db) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const cells = d.stats?.hourly ?? [];
  return days.map((day, i) => ({
    day,
    hours: Array.from({ length: 24 }, (_, h) => cells.find((c) => c.dow === i + 1 && c.hour === h)?.n ?? 0),
  }));
}

export function deviceSplit(d: Db) {
  const names: Record<string, string> = { web: "Web browser", android: "Android", ios: "iPhone / iPad", tv: "Smart TV" };
  return Object.entries(d.stats?.device_kinds ?? {}).map(([k, v]) => ({ name: names[k] ?? k, value: v }));
}

/** Quality cap members stream at, from their plans. */
export function qualitySplit(d: Db) {
  return d.plans.map((p) => ({ name: `${p.name} (${p.resolution})`, value: d.stats?.plan_mix?.[p.id] ?? 0 })).filter((x) => x.value > 0);
}

/** For each of the last 6 months' sign-ups: how many paid, and how many still have access today. */
export function cohorts(d: Db) {
  const now = Date.now();
  return monthKeys(6).map((m) => {
    const joined = d.members.filter((x) => within(x.joinedAt, m.start.getTime(), m.end.getTime()));
    const paid = joined.filter((x) => x.paidUntil);
    const still = paid.filter((x) => x.status !== "suspended" && new Date(x.paidUntil!).getTime() > now);
    return {
      label: m.label,
      size: joined.length,
      paidPct: joined.length ? Math.round((paid.length / joined.length) * 100) : 0,
      retainedPct: paid.length ? Math.round((still.length / paid.length) * 100) : 0,
    };
  });
}
