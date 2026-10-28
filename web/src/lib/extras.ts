"use client";

/**
 * MyFlix extras on Supabase: data-usage meter and screen-time limits, viewing activity,
 * Remind Me, help tickets and referral codes.
 */
import { getState } from "./store";
import { sb } from "./supabase";

/* ---------------- Data usage + screen time ---------------- */
/** GB per hour for a stream height (Data Saver ~0.3, HD ~3, 4K ~7). */
export const gbPerHour = (height: number) => (height <= 0 ? 1 : height <= 480 ? 0.3 : height <= 720 ? 1.2 : height <= 1080 ? 3 : 7);

type UsageCache = { month: { seconds: number; gb: number }; today: number; pending: { seconds: number; gb: number } };
const usage = new Map<string, UsageCache>();
const ensure = (pid: string) => {
  if (!usage.has(pid)) usage.set(pid, { month: { seconds: 0, gb: 0 }, today: 0, pending: { seconds: 0, gb: 0 } });
  return usage.get(pid)!;
};

/** Loads this month's usage for a profile (call when the player or account page opens). */
export async function loadUsage(pid: string) {
  const first = new Date();
  first.setDate(1);
  const { data } = await sb().from("usage_daily").select("day, seconds, gb").eq("profile_id", pid).gte("day", first.toISOString().slice(0, 10));
  const today = new Date().toISOString().slice(0, 10);
  const u = ensure(pid);
  u.month = { seconds: (data ?? []).reduce((a, r) => a + r.seconds, 0) + u.pending.seconds, gb: (data ?? []).reduce((a, r) => a + Number(r.gb), 0) + u.pending.gb };
  u.today = ((data ?? []).find((r) => r.day === today)?.seconds ?? 0) + u.pending.seconds;
  return u;
}

/** Counts watched time locally and sends it to the server every 30 seconds. */
export function addUsage(pid: string, seconds: number, height: number) {
  if (seconds <= 0 || seconds > 30) return;
  const u = ensure(pid);
  const gb = (gbPerHour(height) * seconds) / 3600;
  u.month.seconds += seconds;
  u.month.gb += gb;
  u.today += seconds;
  u.pending.seconds += seconds;
  u.pending.gb += gb;
  if (u.pending.seconds >= 30) flushUsage(pid);
}

export function flushUsage(pid: string) {
  const u = ensure(pid);
  if (u.pending.seconds < 1) return;
  const { seconds, gb } = u.pending;
  u.pending = { seconds: 0, gb: 0 };
  void sb().rpc("add_usage", { p_profile: pid, p_seconds: Math.round(seconds), p_gb: Number(gb.toFixed(3)) });
}

export const thisMonth = (pid: string) => ensure(pid).month;
export const watchedTodayMinutes = (pid: string) => Math.floor(ensure(pid).today / 60);

/* ---------------- Viewing activity ---------------- */
export type ActivityItem = { id: number; titleId: string; season?: number; episode?: number; at: string };

export function logActivity(pid: string, item: { titleId: string; season?: number; episode?: number }) {
  void sb().from("activity").insert({ profile_id: pid, title_id: item.titleId, season: item.season ?? null, episode: item.episode ?? null });
}

export async function activityOf(pid: string): Promise<ActivityItem[]> {
  const { data } = await sb().from("activity").select("id, title_id, season, episode, watched_at").eq("profile_id", pid).eq("hidden", false).order("watched_at", { ascending: false }).limit(300);
  const seen = new Set<string>();
  return (data ?? [])
    .map((r) => ({ id: r.id, titleId: r.title_id, season: r.season ?? undefined, episode: r.episode ?? undefined, at: r.watched_at }))
    .filter((x) => {
      const k = `${x.titleId}|${x.season ?? ""}|${x.episode ?? ""}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

/** Hides every viewing of that title/episode so it stops influencing recommendations. */
export async function hideActivity(pid: string, item: ActivityItem) {
  let q = sb().from("activity").update({ hidden: true }).eq("profile_id", pid).eq("title_id", item.titleId);
  q = item.season ? q.eq("season", item.season).eq("episode", item.episode!) : q;
  await q;
}

export async function clearActivity(pid: string) {
  await sb().from("activity").update({ hidden: true }).eq("profile_id", pid);
}

/* ---------------- Referrals ---------------- */
export const referralCode = () => getState().account?.referral_code ?? "";

/* ---------------- Remind Me (Coming Soon) ---------------- */
export async function remindersOf(pid: string): Promise<string[]> {
  const { data } = await sb().from("reminders").select("title_id").eq("profile_id", pid);
  return (data ?? []).map((r) => r.title_id);
}

export async function toggleReminder(pid: string, id: string, on: boolean) {
  if (on) await sb().from("reminders").delete().eq("profile_id", pid).eq("title_id", id);
  else await sb().from("reminders").insert({ profile_id: pid, title_id: id });
}

/** Titles that have launched since the profile asked to be reminded (each only once). */
export async function takeDueReminders(pid: string, isReleased: (id: string) => boolean) {
  const { data } = await sb().from("reminders").select("title_id").eq("profile_id", pid).eq("notified", false);
  const due = (data ?? []).map((r) => r.title_id).filter(isReleased);
  if (due.length) await sb().from("reminders").update({ notified: true }).eq("profile_id", pid).in("title_id", due);
  return due;
}

/* ---------------- Help tickets (admin Support inbox) ---------------- */
export type Ticket = { id: string; subject: string; category: string; status: "open" | "pending" | "resolved"; created_at: string; updated_at: string; messages: { from_staff: boolean; author: string; body: string; created_at: string }[] };

export async function createTicket(t: { category: string; subject: string; body: string }) {
  const { data, error } = await sb().rpc("create_ticket", { p_category: t.category, p_subject: t.subject, p_body: t.body });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function replyTicket(id: string, author: string, body: string) {
  const { error } = await sb().from("ticket_messages").insert({ ticket_id: id, author, body });
  if (error) throw new Error(error.message);
}

export async function ticketsFor(): Promise<Ticket[]> {
  const { data } = await sb()
    .from("tickets")
    .select("id, subject, category, status, created_at, updated_at, ticket_messages(from_staff, author, body, created_at)")
    .order("updated_at", { ascending: false });
  return (data ?? []).map((t) => ({ ...t, messages: ((t.ticket_messages ?? []) as Ticket["messages"]).sort((a, b) => a.created_at.localeCompare(b.created_at)) })) as Ticket[];
}
