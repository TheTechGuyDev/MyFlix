"use client";

/**
 * Admin data on Supabase. Pages read a synchronous snapshot (useDb) loaded after a staff member
 * signs in with two-step verification; every change is written to the database (Row Level
 * Security checks the staff member's role) and recorded in the audit log.
 */
import { useSyncExternalStore } from "react";
import { defaultSettings } from "./seed";
import { fn, sb } from "./supabase";
import type { AdminStats, AuditEntry, Campaign, Curation, GiftCard, Member, Notice, Plan, Promo, Role, Section, Settings, Staff, Ticket, Title, Txn, VideoAsset } from "./types";

export type Db = {
  titles: Title[];
  plans: Plan[];
  settings: Settings;
  curation: Curation;
  members: Member[];
  txns: Txn[];
  promos: Promo[];
  gifts: GiftCard[];
  campaigns: Campaign[];
  tickets: Ticket[];
  staff: Staff[];
  roles: Role[];
  audit: AuditEntry[];
  notices: Notice[];
  stats: AdminStats | null;
  session: string | null; // staff user id
  ready: boolean;
};

const emptyDb = (): Db => ({
  titles: [], plans: [], settings: defaultSettings(), curation: { rows: [] }, members: [], txns: [], promos: [], gifts: [], campaigns: [], tickets: [], staff: [], roles: [], audit: [], notices: [], stats: null, session: null, ready: false,
});

let db: Db = emptyDb();
let version = 0;
const listeners = new Set<() => void>();

function emit() {
  version++;
  listeners.forEach((l) => l());
}

export function getDb(): Db {
  return db;
}

export function useDb<T>(select: (d: Db) => T): T {
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => version,
    () => -1,
  );
  return select(db);
}

export const uid = (p = "") => p + Math.random().toString(36).slice(2, 10);

/* ============================================================
   Row mapping
   ============================================================ */
type Row = Record<string, unknown>;
const str = (v: unknown) => (v == null ? undefined : String(v));

function titleFromRow(r: Row, episodes: Row[]): Title {
  const eps = episodes.filter((e) => e.title_id === r.id);
  const seasons = [...new Set(eps.map((e) => Number(e.season)))].sort((a, b) => a - b);
  const rights = (r.rights ?? {}) as { owner?: string; type?: "Original" | "Licensed" | "Co-production"; expires?: string; cost?: number };
  return {
    id: String(r.id),
    title: String(r.title),
    image: String(r.image ?? ""),
    backdrop: str(r.backdrop),
    type: r.type as Title["type"],
    year: Number(r.year ?? new Date().getFullYear()),
    maturity: r.maturity as Title["maturity"],
    genres: (r.genres as string[]) ?? [],
    runtime: str(r.runtime),
    seasons: r.seasons == null ? (r.type === "series" ? seasons.length || 1 : undefined) : Number(r.seasons),
    synopsis: String(r.synopsis ?? ""),
    cast: (r.cast_list as string[]) ?? [],
    directors: (r.directors as string[]) ?? [],
    tags: (r.tags as string[]) ?? [],
    match: Number(r.match ?? 90),
    original: Boolean(r.original),
    kids: Boolean(r.kids),
    isNew: Boolean(r.is_new),
    quality: (r.quality as Title["quality"]) ?? "HD",
    status: r.status as Title["status"],
    releaseAt: str(r.release_at),
    expiresAt: str(r.expires_at),
    languages: (r.languages as string[]) ?? [],
    video: (r.video as Title["video"]) ?? undefined,
    subtitles: ((r.subtitles as { lang: string; label: string; url: string }[]) ?? []).map((s, i) => ({ id: `${r.id}-s${i}`, ...s })),
    audioTracks: (r.audio_tracks as Title["audioTracks"]) ?? [],
    introStart: r.intro_start == null ? undefined : Number(r.intro_start),
    introEnd: r.intro_end == null ? undefined : Number(r.intro_end),
    licence: rights.owner ? { owner: rights.owner, type: rights.type ?? "Licensed", expires: rights.expires, cost: rights.cost } : undefined,
    stats: { views: Number(r.views ?? 0), watchHours: 0, completion: 0, likes: 0, trend: [] },
    sample: Boolean(r.sample),
    addedAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    seasonsData: seasons.map((n) => ({
      number: n,
      episodes: eps
        .filter((e) => Number(e.season) === n)
        .sort((a, b) => Number(a.number) - Number(b.number))
        .map((e) => ({
          id: String(e.id),
          number: Number(e.number),
          title: String(e.title),
          runtime: String(e.runtime ?? ""),
          synopsis: String(e.synopsis ?? ""),
          video: (e.video as Title["video"]) ?? undefined,
          introStart: e.intro_start == null ? undefined : Number(e.intro_start),
          introEnd: e.intro_end == null ? undefined : Number(e.intro_end),
        })),
    })),
  };
}

function titleToRow(t: Title) {
  return {
    id: t.id,
    title: t.title,
    type: t.type,
    synopsis: t.synopsis,
    year: t.year,
    maturity: t.maturity,
    genres: t.genres,
    cast_list: t.cast,
    directors: t.directors ?? [],
    tags: t.tags,
    languages: t.languages ?? [],
    image: t.image,
    backdrop: t.backdrop ?? null,
    runtime: t.runtime ?? null,
    seasons: t.type === "series" ? t.seasonsData?.length || t.seasons || 1 : null,
    original: Boolean(t.original),
    kids: Boolean(t.kids),
    is_new: Boolean(t.isNew),
    quality: t.quality,
    match: t.match,
    status: t.status,
    release_at: t.releaseAt ?? null,
    expires_at: t.expiresAt ?? null,
    rights: t.licence ?? {},
    // video is written only by the Mux function and webhook, never from the editor
    subtitles: (t.subtitles ?? []).filter((s) => s.url).map((s) => ({ lang: s.lang, label: s.label, url: s.url })),
    audio_tracks: t.audioTracks ?? [],
    intro_start: t.introStart ?? null,
    intro_end: t.introEnd ?? null,
    sample: Boolean(t.sample),
  };
}

function memberFromRow(r: Row, lastPay?: Row): Member {
  const profiles = ((r.viewer_profiles as Row[]) ?? []).map((p) => ({ name: String(p.name), kids: Boolean(p.kids) }));
  const devices = ((r.devices as { count: number }[]) ?? [])[0]?.count ?? 0;
  const status = String(r.status);
  const paidUntil = str(r.paid_until);
  const ch = String(lastPay?.channel ?? "card");
  return {
    id: String(r.id),
    name: profiles[0]?.name ?? String(r.email).split("@")[0],
    email: String(r.email),
    phone: str(r.phone),
    state: String(r.state ?? ""),
    planId: String(r.plan_id ?? r.pending_plan_id ?? ""),
    status: (status === "pending" ? "pending" : status) as Member["status"],
    joinedAt: String(r.created_at),
    renewsAt: paidUntil ?? String(r.created_at),
    paidUntil,
    cancelAt: str(r.cancel_at),
    credit: Number(r.credit ?? 0),
    billingCycle: str(r.billing_cycle),
    referralCode: str(r.referral_code),
    referredBy: str(r.referred_by),
    method: (ch === "bank_transfer" ? "transfer" : ch) as Member["method"],
    last4: str(lastPay?.last4),
    profiles,
    devices,
    watchHours: 0,
    lastActive: String(r.updated_at ?? r.created_at),
    notes: str(r.staff_notes),
  };
}

function txnFromRow(r: Row, names: Map<string, string>): Txn {
  const ch = String(r.channel ?? "card");
  return {
    id: String(r.id),
    memberId: String(r.account_id ?? ""),
    memberName: names.get(String(r.account_id)) ?? String(r.email).split("@")[0],
    email: String(r.email),
    amount: Number(r.amount),
    planId: String(r.plan_id ?? ""),
    method: (ch === "bank_transfer" ? "transfer" : ch) as Txn["method"],
    status: r.status as Txn["status"],
    kind: str(r.kind),
    at: String(r.paid_at ?? r.created_at),
    reference: String(r.reference),
  };
}

const promoLabel = (p: Promo) => (p.kind === "percent" ? `${p.value}% off` : p.kind === "amount" ? `₦${p.value.toLocaleString("en-NG")} off` : `${p.value} free month${p.value > 1 ? "s" : ""}`);

/* ============================================================
   Loading
   ============================================================ */
export async function loadAll() {
  const c = sb();
  const [titles, episodes, plans, settings, curation, accounts, payments, promos, gifts, campaigns, tickets, staff, roles, audit, notices, stats] = await Promise.all([
    c.from("titles").select("*").order("created_at", { ascending: false }),
    c.from("episodes").select("*"),
    c.from("plans").select("*").order("sort"),
    c.from("site_settings").select("data").eq("id", 1).maybeSingle(),
    c.from("curation").select("data").eq("id", 1).maybeSingle(),
    c.from("accounts").select("*, viewer_profiles(name, kids), devices(count)").order("created_at", { ascending: false }).limit(2000),
    c.from("payments").select("*").order("created_at", { ascending: false }).limit(3000),
    c.from("promos").select("*").order("created_at", { ascending: false }),
    c.from("gift_cards").select("*").order("created_at", { ascending: false }),
    c.from("campaigns").select("*").order("created_at", { ascending: false }),
    c.from("tickets").select("*, ticket_messages(*)").order("updated_at", { ascending: false }).limit(500),
    c.from("staff").select("*").order("created_at"),
    c.from("roles").select("*"),
    c.from("audit_log").select("*").order("at", { ascending: false }).limit(1000),
    c.from("admin_notices").select("*").order("at", { ascending: false }).limit(50),
    c.rpc("admin_stats", { p_days: 30 }),
  ]);

  const lastPay = new Map<string, Row>();
  for (const p of (payments.data ?? []) as Row[]) if (p.status === "success" && !lastPay.has(String(p.account_id))) lastPay.set(String(p.account_id), p);
  const members = ((accounts.data ?? []) as Row[]).filter((a) => !(staff.data ?? []).some((s) => s.user_id === a.id && !a.plan_id)).map((a) => memberFromRow(a, lastPay.get(String(a.id))));
  const names = new Map(members.map((m) => [m.id, m.name]));
  let readUpTo = 0;
  try {
    readUpTo = Number(localStorage.getItem("myflix.admin.noticesRead") ?? "0");
  } catch {
    /* ignore */
  }

  db = {
    ...db,
    titles: ((titles.data ?? []) as Row[]).map((t) => titleFromRow(t, (episodes.data ?? []) as Row[])),
    plans: ((plans.data ?? []) as Row[]).map((p) => ({ ...(p as unknown as Plan), annualDiscount: Number(p.annual_discount ?? 15) })),
    settings: { ...defaultSettings(), ...((settings.data?.data as Partial<Settings>) ?? {}) },
    curation: (curation.data?.data as Curation) ?? { rows: [] },
    members,
    txns: ((payments.data ?? []) as Row[]).filter((p) => p.kind !== "card_update").map((p) => txnFromRow(p, names)),
    promos: ((promos.data ?? []) as Row[]).map((p) => ({
      id: String(p.code),
      code: String(p.code),
      label: String(p.label),
      kind: p.kind as Promo["kind"],
      value: Number(p.value),
      plans: (p.plans as string[]) ?? [],
      maxUses: Number(p.max_uses ?? 0),
      used: Number(p.used ?? 0),
      expiresAt: str(p.expires_at),
      active: Boolean(p.active),
      firstPaymentOnly: Boolean(p.first_payment_only),
      createdAt: String(p.created_at),
    })),
    gifts: ((gifts.data ?? []) as Row[]).map((g) => ({ id: String(g.code), code: String(g.code), amount: Number(g.amount), balance: Number(g.balance), note: str(g.note), redeemedBy: str(g.redeemed_by), redeemedAt: str(g.redeemed_at), createdAt: String(g.created_at) })),
    campaigns: ((campaigns.data ?? []) as Row[]).map((x) => ({
      id: String(x.id), name: String(x.name), channel: x.channel as Campaign["channel"], audience: String(x.audience), subject: String(x.subject), body: String(x.body), titleId: str(x.title_id),
      status: x.status as Campaign["status"], scheduledAt: str(x.scheduled_at), sentAt: str(x.sent_at), reach: Number(x.reach), opens: Number(x.opens), clicks: Number(x.clicks), createdAt: String(x.created_at),
    })),
    tickets: ((tickets.data ?? []) as Row[]).map((t) => ({
      id: String(t.id), subject: String(t.subject), memberId: String(t.account_id ?? ""), memberName: String(t.name), email: String(t.email), category: t.category as Ticket["category"], priority: t.priority as Ticket["priority"],
      status: t.status as Ticket["status"], assignee: str(t.assignee), createdAt: String(t.created_at), updatedAt: String(t.updated_at),
      messages: ((t.ticket_messages as Row[]) ?? []).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))).map((m) => ({ id: Number(m.id), from: m.from_staff ? "staff" : "member", author: String(m.author), body: String(m.body), at: String(m.created_at), internal: Boolean(m.internal) })),
    })),
    staff: ((staff.data ?? []) as Row[]).map((s) => ({ id: String(s.user_id), name: String(s.name), email: String(s.email), roleId: String(s.role_id), active: Boolean(s.active), lastLogin: str(s.last_login), createdAt: String(s.created_at), avatar: Number(s.avatar ?? 0) })),
    roles: ((roles.data ?? []) as Row[]).map((r) => ({ id: String(r.id), name: String(r.name), permissions: r.permissions as Section[], system: Boolean(r.system) })),
    audit: ((audit.data ?? []) as Row[]).map((a) => ({ id: String(a.id), at: String(a.at), staff: String(a.staff_name ?? "System"), action: String(a.action), target: String(a.target ?? "") })),
    notices: ((notices.data ?? []) as Row[]).map((n) => ({ id: String(n.id), at: String(n.at), kind: n.kind as Notice["kind"], text: String(n.text), read: Number(n.id) <= readUpTo })),
    stats: (stats.data as AdminStats) ?? null,
    ready: true,
  };
  emit();
}

export async function refreshStats(days = 30) {
  const { data } = await sb().rpc("admin_stats", { p_days: days });
  db = { ...db, stats: (data as AdminStats) ?? db.stats };
  emit();
  return db.stats;
}

/* ============================================================
   Session, two-step sign-in and permissions
   ============================================================ */
export function currentStaff(d: Db = db) {
  return d.staff.find((s) => s.id === d.session) ?? null;
}
export function roleOf(s: Staff | null, d: Db = db) {
  return d.roles.find((r) => r.id === s?.roleId) ?? null;
}
export function can(section: Section, d: Db = db) {
  const perms = (roleOf(currentStaff(d), d)?.permissions ?? []) as string[];
  return perms.includes("all") || perms.includes(section);
}

export type LoginStep = { step: "mfa-enroll"; factorId: string; qr: string; secret: string } | { step: "mfa-verify"; factorId: string } | { step: "done" } | { step: "error"; error: string };

/** Password step. Returns what's needed next (two-step setup or code). */
export async function login(email: string, password: string): Promise<LoginStep> {
  const c = sb();
  const { error } = await c.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) return { step: "error", error: /Invalid login/i.test(error.message) ? "Incorrect email or password." : error.message };
  // First owner sign-in creates the Super Admin; everyone else must already be staff
  let isStaff = false;
  try {
    isStaff = (await fn<{ staff: boolean }>("admin", { action: "bootstrap" })).staff;
  } catch (e) {
    await c.auth.signOut();
    return { step: "error", error: e instanceof Error ? e.message : "This account isn't MyFlix staff." };
  }
  if (!isStaff) {
    await c.auth.signOut();
    return { step: "error", error: "This account isn't MyFlix staff." };
  }
  return nextMfaStep();
}

export async function nextMfaStep(): Promise<LoginStep> {
  const c = sb();
  const { data: aal } = await c.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal2") return { step: "done" };
  const { data: factors } = await c.auth.mfa.listFactors();
  const verified = factors?.totp?.find((f) => f.status === "verified");
  if (verified) return { step: "mfa-verify", factorId: verified.id };
  // Clean up half-finished enrolments, then start a new one
  for (const f of factors?.all ?? []) if (f.status !== "verified") await c.auth.mfa.unenroll({ factorId: f.id });
  const { data, error } = await c.auth.mfa.enroll({ factorType: "totp", friendlyName: `MyFlix Admin ${new Date().toISOString().slice(0, 10)}` });
  if (error || !data) return { step: "error", error: error?.message ?? "Couldn't start two-step setup." };
  return { step: "mfa-enroll", factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

export async function verifyMfa(factorId: string, code: string): Promise<string | null> {
  const { error } = await sb().auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
  if (error) return /invalid|expired/i.test(error.message) ? "That code isn't right. Check your authenticator app." : error.message;
  return null;
}

/** Loads the staff session (only with two-step sign-in). Returns false if not signed in as staff. */
export async function restoreSession(): Promise<boolean> {
  const c = sb();
  const { data } = await c.auth.getSession();
  if (!data.session) return false;
  const { data: aal } = await c.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") return false;
  db = { ...db, session: data.session.user.id };
  await loadAll();
  if (!currentStaff()) {
    await c.auth.signOut();
    db = emptyDb();
    emit();
    return false;
  }
  if (!sessionStorage.getItem("myflix.admin.loggedIn")) {
    sessionStorage.setItem("myflix.admin.loggedIn", "1");
    await c.from("staff").update({ last_login: new Date().toISOString() }).eq("user_id", data.session.user.id);
    log("Signed in", currentStaff()?.email ?? "");
  }
  return true;
}

export async function logout(reason?: string) {
  if (db.session) log(reason ?? "Signed out", currentStaff()?.email ?? "");
  try {
    sessionStorage.removeItem("myflix.admin.loggedIn");
  } catch {
    /* ignore */
  }
  await sb().auth.signOut();
  db = emptyDb();
  emit();
}

/* ============================================================
   Audit + notices
   ============================================================ */
export function log(action: string, target: string) {
  db.audit.unshift({ id: uid("a"), at: new Date().toISOString(), staff: currentStaff()?.name ?? "System", action, target });
  void sb().rpc("admin_log", { p_action: action, p_target: target });
}

export function notify(kind: Notice["kind"], text: string) {
  db.notices.unshift({ id: uid("n"), at: new Date().toISOString(), kind, text, read: false });
  db = { ...db, notices: db.notices.slice(0, 50) };
  emit();
}

export function markNoticesRead() {
  const top = db.notices.map((n) => Number(n.id)).filter((n) => !isNaN(n));
  try {
    if (top.length) localStorage.setItem("myflix.admin.noticesRead", String(Math.max(...top)));
  } catch {
    /* ignore */
  }
  db = { ...db, notices: db.notices.map((n) => ({ ...n, read: true })) };
  emit();
}

const fail = (what: string, error: { message: string } | null) => {
  if (!error) return;
  console.error(what, error);
  notify("warn", `${what} failed: ${error.message}`);
};

/* ============================================================
   Writes (optimistic in the UI, then saved to the database)
   ============================================================ */
type CollKey = "titles" | "plans" | "members" | "txns" | "promos" | "gifts" | "campaigns" | "tickets" | "staff" | "roles";

function local<K extends CollKey>(coll: K, item: Db[K][number]) {
  const list = [...(db[coll] as Array<{ id: string }>)];
  const i = list.findIndex((x) => x.id === (item as { id: string }).id);
  if (i >= 0) list[i] = item as { id: string };
  else list.unshift(item as { id: string });
  db = { ...db, [coll]: list };
  emit();
}

async function saveTitle(t: Title): Promise<boolean> {
  const { error } = await sb().from("titles").upsert(titleToRow(t));
  if (error) return fail(`Saving "${t.title}"`, error), false;
  if (t.type === "series") {
    const rows = (t.seasonsData ?? []).flatMap((s) =>
      s.episodes.map((e) => ({ id: e.id, title_id: t.id, season: s.number, number: e.number, title: e.title, runtime: e.runtime, synopsis: e.synopsis, intro_start: e.introStart ?? null, intro_end: e.introEnd ?? null })),
    );
    const keep = rows.map((r) => r.id);
    // Free the Mux storage used by episodes that were deleted
    const { data: gone } = await sb().from("episodes").select("id, video").eq("title_id", t.id);
    for (const g of gone ?? []) {
      const v = g.video as VideoAsset | null;
      if (!keep.includes(String(g.id)) && v?.asset_id) await fn("mux", { action: "delete", asset_id: v.asset_id }).catch(() => undefined);
    }
    const del = sb().from("episodes").delete().eq("title_id", t.id);
    const { error: e1 } = keep.length ? await del.not("id", "in", `(${keep.map((k) => `"${k}"`).join(",")})`) : await del;
    if (e1) return fail("Saving episodes", e1), false;
    if (rows.length) {
      // Temporarily move numbers out of the way so re-ordering can't clash with the unique (season, number) rule
      const { error: e2 } = await sb().from("episodes").upsert(rows);
      if (e2) return fail("Saving episodes", e2), false;
    }
  }
  return true;
}

/** Saves a title and waits for the database (needed before a video can be attached to it). */
export async function saveTitleNow(t: Title) {
  // Videos are owned by the server, so keep whatever the dashboard last heard from Mux
  const cur = db.titles.find((x) => x.id === t.id);
  const epVideo = new Map(cur?.seasonsData?.flatMap((s) => s.episodes.map((e) => [e.id, e.video] as const)) ?? []);
  const merged: Title = { ...t, video: cur?.video, seasonsData: t.seasonsData?.map((s) => ({ ...s, episodes: s.episodes.map((e) => ({ ...e, video: epVideo.get(e.id) })) })) };
  local("titles", merged);
  return saveTitle(merged);
}

/** Updates a title's or episode's video in the dashboard only (the server already holds it). */
export function setVideoLocal(titleId: string, episodeId: string | undefined, video: VideoAsset | undefined) {
  const t = db.titles.find((x) => x.id === titleId);
  if (!t) return;
  const next: Title = episodeId
    ? { ...t, seasonsData: t.seasonsData?.map((s) => ({ ...s, episodes: s.episodes.map((e) => (e.id === episodeId ? { ...e, video } : e)) })) }
    : { ...t, video, quality: (video?.height ?? 0) >= 2160 ? "4K" : t.quality };
  local("titles", next);
}

/** Removes a video from Mux and from the title or episode. */
export async function removeVideo(titleId: string, episodeId: string | undefined, video?: VideoAsset) {
  if (video?.asset_id) await fn("mux", { action: "delete", asset_id: video.asset_id }).catch(() => undefined);
  const q = episodeId ? sb().from("episodes").update({ video: null }).eq("id", episodeId) : sb().from("titles").update({ video: null }).eq("id", titleId);
  const { error } = await q;
  fail("Removing video", error);
  setVideoLocal(titleId, episodeId, undefined);
}

async function writeCampaign(x: Campaign): Promise<boolean> {
  const { error } = await sb().from("campaigns").upsert({ id: x.id, name: x.name, channel: x.channel, audience: x.audience, subject: x.subject, body: x.body, title_id: x.titleId ?? null, status: x.status === "scheduled" ? "scheduled" : "draft", scheduled_at: x.scheduledAt ?? null, created_by: db.session });
  fail("Saving campaign", error);
  return !error;
}

/** Saves a campaign and, if asked, sends it now through the campaigns function. Returns how many members it reached. */
export async function saveCampaign(c: Campaign, sendNow: boolean): Promise<number | null> {
  local("campaigns", c);
  if (!(await writeCampaign(c))) return null;
  if (!sendNow) return 0;
  const r = await fn<{ reach: number }>("campaigns", { action: "send", campaign_id: c.id });
  await loadAll();
  return r.reach;
}

export function upsert<K extends CollKey>(coll: K, item: Db[K][number], action?: string, target?: string) {
  const prev = (db[coll] as Array<{ id: string }>).find((x) => x.id === (item as { id: string }).id);
  local(coll, item);
  if (action) log(action, target ?? (item as { id: string }).id);
  const c = sb();
  const run = async () => {
    switch (coll) {
      case "titles":
        return saveTitle(item as Title);
      case "plans": {
        const p = item as Plan;
        return fail("Saving plan", (await c.from("plans").upsert({ id: p.id, name: p.name, price: p.price, annual_discount: p.annualDiscount ?? 15, resolution: p.resolution, quality: p.quality, devices: p.devices, screens: p.screens, downloads: p.downloads, badge: p.badge ?? null, active: p.active, max_height: /4K|2160/.test(p.resolution) ? 2160 : /1440/.test(p.resolution) ? 1440 : /1080/.test(p.resolution) ? 1080 : /720/.test(p.resolution) ? 720 : 480 })).error);
      }
      case "promos": {
        const p = item as Promo;
        return fail("Saving promo", (await c.from("promos").upsert({ code: p.code.toUpperCase(), label: p.label || promoLabel(p), kind: p.kind, value: p.value, plans: p.plans, max_uses: p.maxUses || null, used: p.used, expires_at: p.expiresAt || null, active: p.active, first_payment_only: p.firstPaymentOnly ?? true })).error);
      }
      case "gifts": {
        const g = item as GiftCard;
        return fail("Saving gift card", (await c.from("gift_cards").upsert({ code: g.code, amount: g.amount, balance: g.balance, note: g.note ?? null, created_by: db.session })).error);
      }
      case "campaigns":
        return writeCampaign(item as Campaign);
      case "tickets": {
        const t = item as Ticket;
        const { error } = await c.from("tickets").update({ status: t.status, priority: t.priority, assignee: t.assignee && /^[0-9a-f-]{36}$/.test(t.assignee) ? t.assignee : null }).eq("id", t.id);
        if (error) return fail("Updating ticket", error);
        const known = new Set((prev as Ticket | undefined)?.messages.map((m) => m.at + m.body) ?? []);
        const fresh = t.messages.filter((m) => m.from === "staff" && !m.id && !known.has(m.at + m.body));
        for (const m of fresh) {
          const { error: e2 } = await c.from("ticket_messages").insert({ ticket_id: t.id, from_staff: true, internal: Boolean(m.internal), author: m.author, body: m.body });
          if (e2) return fail("Sending reply", e2);
        }
        return;
      }
      case "staff": {
        const s = item as Staff;
        return fail("Saving staff", (await c.from("staff").update({ name: s.name, role_id: s.roleId, active: s.active, avatar: s.avatar }).eq("user_id", s.id)).error);
      }
      case "roles": {
        const r = item as Role;
        return fail("Saving role", (await c.from("roles").upsert({ id: r.id, name: r.name, permissions: r.permissions, system: Boolean(r.system) })).error);
      }
      case "members": {
        const m = item as Member;
        const statusOut = m.status === "trial" ? "pending" : m.status;
        return fail(
          "Updating member",
          (await c.from("accounts").update({ status: statusOut, plan_id: m.planId || null, paid_until: m.paidUntil ?? null, cancel_at: m.cancelAt ?? null, credit: m.credit ?? 0, staff_notes: m.notes ?? null, state: m.state || null }).eq("id", m.id)).error,
        );
      }
      case "txns":
        return; // payments change only through Paystack (see refund())
    }
  };
  void run();
}

export function remove<K extends CollKey>(coll: K, id: string, action?: string, target?: string) {
  if (coll === "titles") {
    // Delete the title's videos from Mux too, so they stop using storage
    const t = db.titles.find((x) => x.id === id);
    const assets = [t?.video?.asset_id, ...(t?.seasonsData?.flatMap((s) => s.episodes.map((e) => e.video?.asset_id)) ?? [])].filter(Boolean);
    for (const a of assets) void fn("mux", { action: "delete", asset_id: a }).catch(() => undefined);
  }
  db = { ...db, [coll]: (db[coll] as Array<{ id: string }>).filter((x) => x.id !== id) };
  emit();
  if (action) log(action, target ?? id);
  const c = sb();
  const table: Partial<Record<CollKey, [string, string]>> = { titles: ["titles", "id"], plans: ["plans", "id"], promos: ["promos", "code"], gifts: ["gift_cards", "code"], campaigns: ["campaigns", "id"], staff: ["staff", "user_id"], roles: ["roles", "id"] };
  const t = table[coll];
  if (t) void c.from(t[0]).delete().eq(t[1], id).then(({ error }) => fail("Deleting", error));
}

export function setSettings(s: Settings) {
  db = { ...db, settings: s };
  emit();
  log("Updated platform settings", "Settings");
  void sb().from("site_settings").update({ data: s, updated_at: new Date().toISOString() }).eq("id", 1).then(({ error }) => fail("Saving settings", error));
}

export function setCuration(c: Curation, what = "Updated home curation") {
  db = { ...db, curation: c };
  emit();
  log(what, "Curation");
  void sb().from("curation").update({ data: c, updated_at: new Date().toISOString() }).eq("id", 1).then(({ error }) => fail("Saving curation", error));
}

export const allMembers = (d: Db = db) => d.members;

/* ---------------- Server-side staff operations ---------------- */
export async function adminAction(action: string, body: Record<string, unknown>) {
  const r = await fn("admin", { action, ...body });
  await loadAll();
  return r;
}

/** Imports or removes the sample catalogue (for testing playback before real titles are uploaded). */
export async function importSamples(titles: Title[]) {
  for (const t of titles) await saveTitle(t);
  log("Imported sample catalogue", `${titles.length} titles`);
  await loadAll();
}

export async function removeSamples() {
  const { error } = await sb().from("titles").delete().eq("sample", true);
  fail("Removing sample titles", error);
  log("Removed sample catalogue", "titles");
  await loadAll();
}
