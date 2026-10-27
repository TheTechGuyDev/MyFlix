"use client";

/**
 * Admin data store. Everything persists in the browser (localStorage + IndexedDB) and the
 * catalogue, plans, curation and settings keys are read live by the MyFlix web platform on the same site.
 * When Supabase is added, these functions become API calls; pages don't change.
 */
import { useSyncExternalStore } from "react";
import {
  DEMO_PASSWORD,
  seedCampaigns,
  seedCuration,
  seedGiftCards,
  seedMembers,
  seedPlans,
  seedPromos,
  seedRoles,
  seedSettings,
  seedStaff,
  seedTickets,
  seedTitles,
  seedTxns,
} from "./seed";
import type { AuditEntry, Campaign, Curation, GiftCard, Member, Notice, Plan, Promo, Role, Section, Settings, Staff, Ticket, Title, Txn } from "./types";

export const KEYS = {
  catalog: "myflix.admin.catalog",
  plans: "myflix.admin.plans",
  settings: "myflix.admin.settings",
  curation: "myflix.admin.curation",
  members: "myflix.admin.members",
  txns: "myflix.admin.txns",
  promos: "myflix.admin.promos",
  gifts: "myflix.admin.gifts",
  campaigns: "myflix.admin.campaigns",
  tickets: "myflix.admin.tickets",
  staff: "myflix.admin.staff",
  roles: "myflix.admin.roles",
  audit: "myflix.admin.audit",
  notices: "myflix.admin.notices",
  session: "myflix.admin.session",
  webUsers: "myflix.users",
} as const;

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
  session: string | null;
  webMembers: Member[];
};

let db: Db | null = null;
let version = 0;
const listeners = new Set<() => void>();

const read = <T,>(k: string): T | null => {
  try {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch (e) {
    console.warn("Storage full or unavailable", e);
    notify("warn", "Browser storage is full. Remove some uploads or posters to save more changes.");
  }
};

export async function sha(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Members who signed up on the real web platform (stored by the web app on the same site). */
function loadWebMembers(): Member[] {
  type WebAccount = {
    email: string;
    createdAt: string;
    planId?: string;
    phone?: string;
    cancelAt?: string;
    suspended?: boolean;
    payment?: { method: "card" | "transfer" | "ussd"; last4?: string; renewsAt: string };
    profiles: { name: string; kids: boolean }[];
    devices?: unknown[];
  };
  const users = read<Record<string, WebAccount>>(KEYS.webUsers) ?? {};
  return Object.values(users).map((u) => ({
    id: `web:${u.email}`,
    name: u.profiles?.[0]?.name ?? u.email.split("@")[0],
    email: u.email,
    phone: u.phone,
    state: "Lagos",
    planId: u.planId ?? "standard",
    status: u.suspended ? "suspended" : u.cancelAt ? "cancelled" : u.payment ? "active" : "trial",
    joinedAt: u.createdAt,
    renewsAt: u.payment?.renewsAt ?? u.createdAt,
    method: u.payment?.method ?? "card",
    last4: u.payment?.last4,
    profiles: (u.profiles ?? []).map((p) => ({ name: p.name, kids: p.kids })),
    devices: u.devices?.length ?? 1,
    watchHours: 0,
    lastActive: new Date().toISOString(),
    source: "web",
  }));
}

function load(): Db {
  const titles = read<Title[]>(KEYS.catalog) ?? seedTitles();
  const plans = read<Plan[]>(KEYS.plans) ?? seedPlans();
  const members = read<Member[]>(KEYS.members) ?? seedMembers();
  const d: Db = {
    titles,
    plans,
    settings: { ...seedSettings(), ...(read<Settings>(KEYS.settings) ?? {}) },
    curation: read<Curation>(KEYS.curation) ?? seedCuration(titles),
    members,
    txns: read<Txn[]>(KEYS.txns) ?? seedTxns(members, plans),
    promos: read<Promo[]>(KEYS.promos) ?? seedPromos(),
    gifts: read<GiftCard[]>(KEYS.gifts) ?? seedGiftCards(),
    campaigns: read<Campaign[]>(KEYS.campaigns) ?? seedCampaigns(),
    tickets: read<Ticket[]>(KEYS.tickets) ?? seedTickets(members),
    staff: read<Staff[]>(KEYS.staff) ?? [],
    roles: read<Role[]>(KEYS.roles) ?? seedRoles(),
    audit: read<AuditEntry[]>(KEYS.audit) ?? [],
    notices: read<Notice[]>(KEYS.notices) ?? [
      { id: "n1", at: new Date().toISOString(), kind: "warn", text: "3 licences expire in the next 60 days.", read: false },
      { id: "n2", at: new Date().toISOString(), kind: "info", text: "4 support tickets are waiting for a reply.", read: false },
    ],
    session: read<string>(KEYS.session),
    webMembers: loadWebMembers(),
  };
  // First run: persist everything the web platform reads
  if (!read(KEYS.catalog)) write(KEYS.catalog, d.titles);
  if (!read(KEYS.plans)) write(KEYS.plans, d.plans);
  if (!read(KEYS.settings)) write(KEYS.settings, d.settings);
  if (!read(KEYS.curation)) write(KEYS.curation, d.curation);
  // Shared with the site (promo codes at checkout, gift redemption, help tickets, notifications)
  if (!read(KEYS.promos)) write(KEYS.promos, d.promos);
  if (!read(KEYS.gifts)) write(KEYS.gifts, d.gifts);
  if (!read(KEYS.campaigns)) write(KEYS.campaigns, d.campaigns);
  if (!read(KEYS.tickets)) write(KEYS.tickets, d.tickets);
  if (!read(KEYS.roles)) write(KEYS.roles, d.roles);
  return d;
}

export async function ensureStaff() {
  const d = getDb();
  if (d.staff.length) return;
  d.staff = seedStaff(await sha(DEMO_PASSWORD));
  write(KEYS.staff, d.staff);
  emit();
}

export function getDb(): Db {
  if (!db) db = load();
  return db;
}

function emit() {
  version++;
  listeners.forEach((l) => l());
}

export function useDb<T>(select: (d: Db) => T): T {
  const snap = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      // Another tab (admin or the MyFlix site) changed shared data: reload so tickets, sign-ups,
      // redeemed gift cards and promo usage appear live.
      const onStorage = (e: StorageEvent) => {
        if (!e.key || !e.key.startsWith("myflix.") || e.key === KEYS.session) return;
        if (e.key === KEYS.webUsers && db) db.webMembers = loadWebMembers();
        else db = null;
        emit();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(cb);
        window.removeEventListener("storage", onStorage);
      };
    },
    () => version,
    () => -1,
  );
  if (snap === -1) return select(emptyDb);
  return select(getDb());
}

const emptyDb: Db = {
  titles: [], plans: [], settings: seedSettings(), curation: { rows: [] }, members: [], txns: [], promos: [], gifts: [], campaigns: [], tickets: [], staff: [], roles: [], audit: [], notices: [], session: null, webMembers: [],
};

/* ---------------- Session & permissions ---------------- */
export function currentStaff(d: Db = getDb()) {
  return d.staff.find((s) => s.id === d.session) ?? null;
}
export function roleOf(s: Staff | null, d: Db = getDb()) {
  return d.roles.find((r) => r.id === s?.roleId) ?? null;
}
export function can(section: Section, d: Db = getDb()) {
  return Boolean(roleOf(currentStaff(d), d)?.permissions.includes(section));
}

export async function login(email: string, password: string): Promise<string | null> {
  await ensureStaff();
  const d = getDb();
  const s = d.staff.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
  if (!s || s.passwordHash !== (await sha(password))) return "Incorrect email or password.";
  if (!s.active) return "This staff account has been deactivated.";
  s.lastLogin = new Date().toISOString();
  d.session = s.id;
  write(KEYS.staff, d.staff);
  write(KEYS.session, s.id);
  log("Signed in", s.email);
  emit();
  return null;
}

export function logout() {
  const d = getDb();
  log("Signed out", currentStaff(d)?.email ?? "");
  d.session = null;
  write(KEYS.session, null);
  emit();
}

/* ---------------- Audit + notices ---------------- */
export const uid = (p = "") => p + Math.random().toString(36).slice(2, 10);

export function log(action: string, target: string) {
  const d = getDb();
  d.audit.unshift({ id: uid("a"), at: new Date().toISOString(), staff: currentStaff(d)?.name ?? "System", action, target });
  d.audit = d.audit.slice(0, 1000);
  write(KEYS.audit, d.audit);
}

export function notify(kind: Notice["kind"], text: string) {
  const d = getDb();
  d.notices.unshift({ id: uid("n"), at: new Date().toISOString(), kind, text, read: false });
  d.notices = d.notices.slice(0, 50);
  write(KEYS.notices, d.notices);
  emit();
}

export function markNoticesRead() {
  const d = getDb();
  d.notices.forEach((n) => (n.read = true));
  write(KEYS.notices, d.notices);
  emit();
}

/* ---------------- Generic collection mutation ---------------- */
type CollKey = "titles" | "plans" | "members" | "txns" | "promos" | "gifts" | "campaigns" | "tickets" | "staff" | "roles";
const collKey: Record<CollKey, string> = {
  titles: KEYS.catalog,
  plans: KEYS.plans,
  members: KEYS.members,
  txns: KEYS.txns,
  promos: KEYS.promos,
  gifts: KEYS.gifts,
  campaigns: KEYS.campaigns,
  tickets: KEYS.tickets,
  staff: KEYS.staff,
  roles: KEYS.roles,
};

export function upsert<K extends CollKey>(coll: K, item: Db[K][number], action?: string, target?: string) {
  const d = getDb();
  const list = d[coll] as Array<{ id: string }>;
  const i = list.findIndex((x) => x.id === (item as { id: string }).id);
  if (i >= 0) list[i] = item as { id: string };
  else list.unshift(item as { id: string });
  write(collKey[coll], list);
  if (action) log(action, target ?? (item as { id: string }).id);
  emit();
}

export function remove<K extends CollKey>(coll: K, id: string, action?: string, target?: string) {
  const d = getDb();
  (d[coll] as Array<{ id: string }>) = (d[coll] as Array<{ id: string }>).filter((x) => x.id !== id);
  write(collKey[coll], d[coll]);
  if (action) log(action, target ?? id);
  emit();
}

export function setSettings(s: Settings) {
  const d = getDb();
  d.settings = s;
  write(KEYS.settings, s);
  log("Updated platform settings", "Settings");
  emit();
}

export function setCuration(c: Curation, what = "Updated home curation") {
  const d = getDb();
  d.curation = c;
  write(KEYS.curation, c);
  log(what, "Curation");
  emit();
}

/** Applies a change to a web-platform account (suspend, plan change) so the live site respects it. */
export function updateWebAccount(email: string, patch: Record<string, unknown>) {
  const users = read<Record<string, Record<string, unknown>>>(KEYS.webUsers) ?? {};
  if (!users[email]) return;
  users[email] = { ...users[email], ...patch };
  for (const [k, v] of Object.entries(patch)) if (v === undefined) delete users[email][k];
  write(KEYS.webUsers, users);
  getDb().webMembers = loadWebMembers();
  emit();
}

export function allMembers(d: Db = getDb()) {
  return [...d.webMembers, ...d.members];
}

/** Wipes local admin data and re-seeds (Settings > Danger zone). */
export function resetDemoData() {
  Object.values(KEYS).forEach((k) => {
    if (k !== KEYS.webUsers && k !== KEYS.session) localStorage.removeItem(k);
  });
  db = null;
  getDb();
  emit();
}
