"use client";

/**
 * MyFlix extras that go beyond Netflix: data-usage meter, kids screen-time limits, promo codes,
 * gift cards, referrals, TV sign-in codes, in-app help tickets and notifications from admin campaigns.
 * Promo codes, gift cards, tickets and campaigns are shared with the admin dashboard on the same site.
 */

const read = <T,>(k: string, fb: T): T => {
  try {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : fb;
  } catch {
    return fb;
  }
};
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* storage full */
  }
};

const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);

/* ---------------- Data usage + screen time ---------------- */
export type Usage = { months: Record<string, { seconds: number; gb: number }>; days: Record<string, number> };

/** GB per hour for a stream height (Data Saver ~0.3, HD ~3, 4K ~7). */
export const gbPerHour = (height: number) => (height <= 0 ? 1 : height <= 480 ? 0.3 : height <= 720 ? 1.2 : height <= 1080 ? 3 : 7);

export function usageOf(profileId: string): Usage {
  return read<Usage>(`myflix.usage.${profileId}`, { months: {}, days: {} });
}

export function addUsage(profileId: string, seconds: number, height: number) {
  if (seconds <= 0 || seconds > 30) return;
  const u = usageOf(profileId);
  const m = monthKey();
  const cur = u.months[m] ?? { seconds: 0, gb: 0 };
  u.months[m] = { seconds: cur.seconds + seconds, gb: cur.gb + (gbPerHour(height) * seconds) / 3600 };
  const d = dayKey();
  u.days = { [d]: (u.days[d] ?? 0) + seconds }; // only keep today
  write(`myflix.usage.${profileId}`, u);
}

export function thisMonth(profileId: string) {
  return usageOf(profileId).months[monthKey()] ?? { seconds: 0, gb: 0 };
}

export function watchedTodayMinutes(profileId: string) {
  return Math.floor((usageOf(profileId).days[dayKey()] ?? 0) / 60);
}

/* ---------------- Viewing activity ---------------- */
export type ActivityItem = { titleId: string; season?: number; episode?: number; at: string };

export function logActivity(profileId: string, item: Omit<ActivityItem, "at">) {
  const list = read<ActivityItem[]>(`myflix.activity.${profileId}`, []);
  const key = `${item.titleId}|${item.season ?? ""}|${item.episode ?? ""}`;
  const next = [{ ...item, at: new Date().toISOString() }, ...list.filter((x) => `${x.titleId}|${x.season ?? ""}|${x.episode ?? ""}` !== key)].slice(0, 300);
  write(`myflix.activity.${profileId}`, next);
}

export function activityOf(profileId: string) {
  return read<ActivityItem[]>(`myflix.activity.${profileId}`, []);
}

export function hideActivity(profileId: string, at: string) {
  write(`myflix.activity.${profileId}`, activityOf(profileId).filter((x) => x.at !== at));
}

export function clearActivity(profileId: string) {
  write(`myflix.activity.${profileId}`, []);
}

/* ---------------- Promo codes (created in admin) ---------------- */
type Promo = { id: string; code: string; kind: "percent" | "amount" | "free_months"; value: number; plans: string[]; maxUses: number; used: number; expiresAt?: string; active: boolean };

export type PromoResult = { ok: true; code: string; label: string; apply: (price: number) => number; freeMonths: number } | { ok: false; error: string };

export function checkPromo(code: string, planId: string): PromoResult {
  const c = code.trim().toUpperCase();
  if (!c) return { ok: false, error: "Enter a promo code." };
  const list = read<Promo[]>("myflix.admin.promos", []);
  const fallback: Promo[] = [
    { id: "p1", code: "WELCOME50", kind: "percent", value: 50, plans: ["basic", "standard", "premium"], maxUses: 5000, used: 0, active: true },
    { id: "p3", code: "STUDENT", kind: "amount", value: 500, plans: ["mobile", "basic"], maxUses: 20000, used: 0, active: true },
  ];
  const p = (list.length ? list : fallback).find((x) => x.code === c);
  if (!p || !p.active) return { ok: false, error: "That promo code isn't valid." };
  if (p.expiresAt && new Date(p.expiresAt).getTime() < Date.now()) return { ok: false, error: "That promo code has expired." };
  if (p.used >= p.maxUses) return { ok: false, error: "That promo code has been fully used." };
  if (!p.plans.includes(planId)) return { ok: false, error: "That code doesn't apply to your plan." };
  const label = p.kind === "percent" ? `${p.value}% off your first month` : p.kind === "amount" ? `₦${p.value.toLocaleString()} off your first month` : `${p.value} free month${p.value > 1 ? "s" : ""}`;
  return {
    ok: true,
    code: c,
    label,
    freeMonths: p.kind === "free_months" ? p.value : 0,
    apply: (price) => (p.kind === "percent" ? Math.round(price * (1 - p.value / 100)) : p.kind === "amount" ? Math.max(0, price - p.value) : 0),
  };
}

export function redeemPromoUse(code: string) {
  const list = read<Promo[]>("myflix.admin.promos", []);
  const p = list.find((x) => x.code === code);
  if (p) {
    p.used += 1;
    write("myflix.admin.promos", list);
  }
}

/* ---------------- Gift cards (issued in admin) ---------------- */
type Gift = { id: string; code: string; amount: number; balance: number; createdAt: string; redeemedBy?: string };

export function redeemGift(code: string, by: string): { ok: true; amount: number } | { ok: false; error: string } {
  const c = code.trim().toUpperCase();
  if (!/^MYF-[A-Z0-9]{4,10}$/.test(c)) return { ok: false, error: "Gift codes look like MYF-ABC123." };
  const list = read<Gift[]>("myflix.admin.gifts", []);
  const g = list.find((x) => x.code === c);
  if (!g) return { ok: false, error: "We couldn't find that gift card. Check the code and try again." };
  if (g.balance <= 0) return { ok: false, error: "This gift card has already been redeemed." };
  const amount = g.balance;
  g.balance = 0;
  g.redeemedBy = by;
  write("myflix.admin.gifts", list);
  return { ok: true, amount };
}

/* ---------------- Referrals ---------------- */
export function referralCode(email: string) {
  let h = 0;
  for (const ch of email) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `NAIJA${h.toString(36).toUpperCase().slice(0, 5)}`;
}

/* ---------------- TV / device sign-in codes ---------------- */
export const validTvCode = (c: string) => /^\d{8}$/.test(c.replace(/\D/g, ""));

/* ---------------- Help tickets -> admin Support inbox ---------------- */
type Ticket = {
  id: string; subject: string; memberId: string; memberName: string; email: string;
  category: "Billing" | "Playback" | "Account" | "Content" | "Other"; priority: "low" | "normal" | "high" | "urgent";
  status: "open" | "pending" | "resolved"; assignee?: string;
  messages: { from: "member" | "staff"; author: string; body: string; at: string }[]; createdAt: string; updatedAt: string;
};

export function createTicket(t: { email: string; name: string; category: Ticket["category"]; subject: string; body: string }) {
  const list = read<Ticket[]>("myflix.admin.tickets", []);
  const id = `TCK-${2000 + list.length + Math.floor(Math.random() * 90)}`;
  const now = new Date().toISOString();
  const ticket: Ticket = {
    id, subject: t.subject, memberId: `web:${t.email}`, memberName: t.name, email: t.email, category: t.category,
    priority: t.category === "Billing" ? "high" : "normal", status: "open",
    messages: [{ from: "member", author: t.name, body: t.body, at: now }], createdAt: now, updatedAt: now,
  };
  write("myflix.admin.tickets", [ticket, ...list]);
  return id;
}

export function ticketsFor(email: string) {
  return read<Ticket[]>("myflix.admin.tickets", []).filter((t) => t.email === email);
}

/* ---------------- Notifications from admin campaigns ---------------- */
type Campaign = { id: string; channel: string; subject: string; body: string; titleId?: string; status: string; sentAt?: string };

export function campaignNotices() {
  return read<Campaign[]>("myflix.admin.campaigns", [])
    .filter((c) => c.status === "sent" && (c.channel === "push" || c.channel === "in_app"))
    .map((c) => ({ id: c.id, head: c.subject, body: c.body, titleId: c.titleId, at: c.sentAt ?? "" }));
}
