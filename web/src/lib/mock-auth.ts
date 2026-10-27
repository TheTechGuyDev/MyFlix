/**
 * Temporary in-browser auth + account store.
 * Every function is async and returns the same shapes a real backend would,
 * so this file can later be swapped for Supabase without touching the screens.
 * NOTE: demo only. Never store real card data here.
 */
import type { PlanId } from "./plans";

export type PaymentMethod = "card" | "transfer" | "ussd";

export type Maturity = "All" | "7+" | "13+" | "16+" | "18+";
export type DataUsage = "auto" | "saver" | "hd" | "4k";

export type ProfileSettings = {
  language: string;
  maturity: Maturity;
  pin?: string;
  autoplayNext: boolean;
  autoplayPreviews: boolean;
  dataUsage: DataUsage;
  subtitleSize: "small" | "medium" | "large";
  subtitleBg: "none" | "shadow" | "box";
};

export type Profile = {
  id: string;
  name: string;
  avatar: number;
  kids: boolean;
  settings?: Partial<ProfileSettings>;
};

export type BillingRecord = {
  id: string;
  date: string;
  amount: number;
  planId: PlanId;
  method: PaymentMethod;
  last4?: string;
  status: "Paid" | "Refunded";
};

export type Device = { id: string; name: string; location: string; lastUsed: string; current?: boolean };

export type NotificationPrefs = {
  newArrivals: boolean;
  reminders: boolean;
  recommendations: boolean;
  billing: boolean;
  offers: boolean;
  push: boolean;
};

export type Account = {
  email: string;
  passwordHash: string;
  createdAt: string;
  phone?: string;
  planId?: PlanId;
  payment?: { method: PaymentMethod; last4?: string; paidAt: string; renewsAt: string };
  cancelAt?: string;
  billing?: BillingRecord[];
  devices?: Device[];
  notifications?: NotificationPrefs;
  profiles: Profile[];
  suspended?: boolean;
};

export const defaultSettings = (kids: boolean): ProfileSettings => ({
  language: "English",
  maturity: kids ? "7+" : "18+",
  autoplayNext: true,
  autoplayPreviews: true,
  dataUsage: "auto",
  subtitleSize: "medium",
  subtitleBg: "shadow",
});

export const settingsOf = (p: Profile): ProfileSettings => ({ ...defaultSettings(p.kids), ...p.settings });

export const defaultNotifications: NotificationPrefs = {
  newArrivals: true,
  reminders: true,
  recommendations: true,
  billing: true,
  offers: false,
  push: true,
};

const USERS_KEY = "myflix.users";
const SESSION_KEY = "myflix.session";
const PROFILE_KEY = "myflix.activeProfile";

export const MAX_PROFILES = 5;

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
};

const wait = (ms = 600) => new Promise((r) => setTimeout(r, ms));

async function hash(text: string) {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const normal = (email: string) => email.trim().toLowerCase();
const users = () => read<Record<string, Account>>(USERS_KEY, {});
const saveUser = (acc: Account) => write(USERS_KEY, { ...users(), [acc.email]: acc });

export type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

export function getSessionEmail(): string | null {
  return read<string | null>(SESSION_KEY, null);
}

export function getAccount(): Account | null {
  const email = getSessionEmail();
  return email ? users()[email] ?? null : null;
}

export async function emailExists(email: string) {
  return Boolean(users()[normal(email)]);
}

export async function signUp(email: string, password: string): Promise<Result<Account>> {
  await wait();
  const e = normal(email);
  if (users()[e]) return { ok: false, error: "An account with this email already exists. Sign in instead." };
  const acc: Account = { email: e, passwordHash: await hash(password), createdAt: new Date().toISOString(), profiles: [] };
  saveUser(acc);
  write(SESSION_KEY, e);
  return { ok: true, data: acc };
}

export async function signIn(email: string, password: string, remember = true): Promise<Result<Account>> {
  await wait();
  const acc = users()[normal(email)];
  if (!acc) return { ok: false, error: "We can't find an account with this email address. Please try again or create a new account." };
  if (acc.passwordHash !== (await hash(password))) return { ok: false, error: "Incorrect password. Please try again or reset your password." };
  if (acc.suspended) return { ok: false, error: "This account has been suspended. Contact MyFlix support to restore access." };
  write(SESSION_KEY, acc.email);
  if (!remember) sessionStorage.setItem("myflix.tempSession", "1");
  return { ok: true, data: acc };
}

export function signOut() {
  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(PROFILE_KEY);
  } catch {
    /* ignore */
  }
}

export async function requestPasswordReset(email: string): Promise<Result> {
  await wait();
  void email; // Real backend sends a reset email here.
  return { ok: true, data: undefined };
}

function update(mutator: (acc: Account) => Account): Result<Account> {
  const acc = getAccount();
  if (!acc) return { ok: false, error: "Your session has expired. Please sign in again." };
  const next = mutator(acc);
  saveUser(next);
  return { ok: true, data: next };
}

export async function choosePlan(planId: PlanId) {
  await wait(300);
  return update((a) => ({ ...a, planId }));
}

export async function completePayment(method: PaymentMethod, last4?: string) {
  await wait(1500);
  const now = new Date();
  const renews = new Date(now);
  renews.setMonth(renews.getMonth() + 1);
  return update((a) => ({
    ...a,
    payment: { method, last4, paidAt: now.toISOString(), renewsAt: renews.toISOString() },
    billing: [
      { id: `INV-${Date.now().toString().slice(-8)}`, date: now.toISOString(), amount: planPrice(a.planId), planId: a.planId ?? "standard", method, last4, status: "Paid" as const },
      ...(a.billing ?? []),
    ],
    devices: a.devices ?? [thisDevice()],
  }));
}

/* ---------------- Account management ---------------- */

const PRICES: Record<string, number> = { mobile: 1500, basic: 2500, standard: 4000, premium: 5500 };
const planPrice = (id?: PlanId) => PRICES[id ?? "standard"] ?? 0;

function thisDevice(): Device {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const browser = /Edg/.test(ua) ? "Edge" : /Chrome/.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : /Firefox/.test(ua) ? "Firefox" : "Browser";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Linux";
  return { id: "this", name: `${browser} on ${os}`, location: "Lagos, Nigeria", lastUsed: new Date().toISOString(), current: true };
}

/** Billing history, including a record derived from the first payment for older demo accounts. */
export function billingHistory(a: Account): BillingRecord[] {
  if (a.billing?.length) return a.billing;
  if (!a.payment) return [];
  return [{ id: "INV-00000001", date: a.payment.paidAt, amount: planPrice(a.planId), planId: a.planId ?? "standard", method: a.payment.method, last4: a.payment.last4, status: "Paid" }];
}

export function devicesOf(a: Account): Device[] {
  const now = Date.now();
  const list = a.devices ?? [thisDevice()];
  const others: Device[] = [
    { id: "tv", name: "Samsung Smart TV", location: "Lagos, Nigeria", lastUsed: new Date(now - 864e5).toISOString() },
    { id: "android", name: "MyFlix app on Android", location: "Ibadan, Nigeria", lastUsed: new Date(now - 3 * 864e5).toISOString() },
  ];
  return a.devices ? list : [...list, ...others];
}

export async function changePlanNow(planId: PlanId) {
  await wait(800);
  return update((a) => ({ ...a, planId }));
}

export async function cancelMembership() {
  await wait(800);
  return update((a) => ({ ...a, cancelAt: a.payment?.renewsAt ?? new Date().toISOString() }));
}

export async function restartMembership() {
  await wait(800);
  return update((a) => ({ ...a, cancelAt: undefined }));
}

export async function updatePaymentMethod(method: PaymentMethod, last4?: string) {
  await wait(1000);
  return update((a) => (a.payment ? { ...a, payment: { ...a.payment, method, last4 } } : a));
}

export async function changeEmail(newEmail: string, password: string): Promise<Result<Account>> {
  await wait(800);
  const acc = getAccount();
  if (!acc) return { ok: false, error: "Your session has expired. Please sign in again." };
  if (acc.passwordHash !== (await hash(password))) return { ok: false, error: "Incorrect password." };
  const e = normal(newEmail);
  if (e !== acc.email && users()[e]) return { ok: false, error: "Another account already uses this email." };
  const all = users();
  delete all[acc.email];
  const next = { ...acc, email: e };
  write(USERS_KEY, { ...all, [e]: next });
  write(SESSION_KEY, e);
  return { ok: true, data: next };
}

export async function changePassword(current: string, nextPw: string): Promise<Result<Account>> {
  await wait(800);
  const acc = getAccount();
  if (!acc) return { ok: false, error: "Your session has expired. Please sign in again." };
  if (acc.passwordHash !== (await hash(current))) return { ok: false, error: "Your current password is incorrect." };
  const passwordHash = await hash(nextPw);
  return update((a) => ({ ...a, passwordHash }));
}

export async function updatePhone(phone: string) {
  await wait(500);
  return update((a) => ({ ...a, phone }));
}

export async function signOutAllDevices() {
  await wait(800);
  update((a) => ({ ...a, devices: [thisDevice()] }));
  signOut();
}

export async function removeDevice(id: string) {
  await wait(400);
  return update((a) => ({ ...a, devices: devicesOf(a).filter((d) => d.id !== id) }));
}

export async function updateProfile(profile: Profile) {
  await wait(500);
  return update((a) => ({ ...a, profiles: a.profiles.map((p) => (p.id === profile.id ? profile : p)) }));
}

export async function updateNotifications(n: NotificationPrefs) {
  await wait(400);
  return update((a) => ({ ...a, notifications: n }));
}

export async function saveProfiles(profiles: Profile[]) {
  await wait(400);
  return update((a) => ({ ...a, profiles: profiles.slice(0, MAX_PROFILES) }));
}

export function setActiveProfile(id: string) {
  write(PROFILE_KEY, id);
}

export function getActiveProfileId(): string | null {
  return read<string | null>(PROFILE_KEY, null);
}

/** Where a signed-in user should go next to finish setup. */
export function nextStep(acc: Account | null): string {
  if (!acc) return "/signup";
  if (!acc.planId) return "/signup/plan";
  if (!acc.payment) return "/signup/payment";
  if (acc.profiles.length === 0) return "/signup/profiles";
  return "/profiles";
}

export const newId = () => Math.random().toString(36).slice(2, 10);
