/**
 * Temporary in-browser auth + account store.
 * Every function is async and returns the same shapes a real backend would,
 * so this file can later be swapped for Supabase without touching the screens.
 * NOTE: demo only. Never store real card data here.
 */
import type { PlanId } from "./plans";
import { checkCode, consumeResetToken, isPhoneLike, issueCode, issueResetToken, normalPhone, prettyPhone, send } from "./messaging";

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
  dailyLimitMinutes?: number;
  monthlyDataCapGB?: number;
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
  billingCycle?: "monthly" | "annual";
  credit?: number;
  promo?: { code: string; label: string };
  referredBy?: string;
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
  send({ channel: "email", kind: "welcome", to: e, subject: "Welcome to MyFlix", body: "Your account is ready. Pick a plan to start watching Nollywood hits, series and more." });
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

/** Finds an account by email or Nigerian phone number. */
export function findAccount(identifier: string): Account | null {
  const all = users();
  if (isPhoneLike(identifier)) {
    const p = normalPhone(identifier);
    return Object.values(all).find((a) => a.phone && normalPhone(a.phone) === p) ?? null;
  }
  return all[normal(identifier)] ?? null;
}

/** Sends a reset link by email, or a code + link by SMS when a phone number is given. */
export async function requestPasswordReset(identifier: string): Promise<Result<{ channel: "email" | "sms" }>> {
  await wait();
  const acc = findAccount(identifier);
  const sms = isPhoneLike(identifier);
  // Same response whether or not the account exists, so emails can't be discovered.
  if (!acc) return { ok: true, data: { channel: sms ? "sms" : "email" } };
  const token = issueResetToken(acc.email);
  const link = `/login/reset?token=${token}`;
  if (sms) {
    send({ channel: "sms", kind: "reset", to: prettyPhone(normalPhone(identifier)), subject: "MyFlix password reset", body: `Reset your MyFlix password with this link. It expires in 1 hour.`, link });
  } else {
    send({ channel: "email", kind: "reset", to: acc.email, subject: "Reset your MyFlix password", body: "We got a request to reset your password. The link below works for 1 hour. If this wasn't you, you can ignore this email.", link });
  }
  return { ok: true, data: { channel: sms ? "sms" : "email" } };
}

export const resetTokenEmail = (token: string) => consumeResetToken(token, true);

export async function resetPassword(token: string, password: string): Promise<Result<Account>> {
  await wait();
  const email = consumeResetToken(token);
  if (!email) return { ok: false, error: "This reset link has expired or was already used. Request a new one." };
  const acc = users()[email];
  if (!acc) return { ok: false, error: "We couldn't find this account." };
  const next = { ...acc, passwordHash: await hash(password) };
  saveUser(next);
  write(SESSION_KEY, email);
  send({ channel: "email", kind: "security", to: email, subject: "Your MyFlix password was changed", body: "Your password was just reset. If you didn't do this, contact help@myflix.ng right away." });
  return { ok: true, data: next };
}

/** "Use a sign-in code": 6-digit code by SMS (phone) or email. */
export async function requestSignInCode(identifier: string): Promise<Result<{ to: string; channel: "email" | "sms" }>> {
  await wait();
  const acc = findAccount(identifier);
  const sms = isPhoneLike(identifier);
  if (!acc) return { ok: false, error: sms ? "No account uses this phone number. Add your number in Account, Security first." : "We can't find an account with this email address." };
  if (acc.suspended) return { ok: false, error: "This account has been suspended. Contact MyFlix support to restore access." };
  const key = sms ? normalPhone(identifier) : acc.email;
  const code = issueCode(key, acc.email);
  const to = sms ? prettyPhone(key) : acc.email;
  send({ channel: sms ? "sms" : "email", kind: "code", to, subject: "Your MyFlix sign-in code", body: `${code} is your MyFlix sign-in code. It expires in 10 minutes. Never share it with anyone.` });
  return { ok: true, data: { to, channel: sms ? "sms" : "email" } };
}

export async function verifySignInCode(identifier: string, code: string): Promise<Result<Account>> {
  await wait(400);
  const key = isPhoneLike(identifier) ? normalPhone(identifier) : normal(identifier);
  const res = checkCode(key, code);
  if (!res.ok) return res;
  const acc = users()[res.email];
  if (!acc) return { ok: false, error: "We couldn't find this account." };
  write(SESSION_KEY, acc.email);
  return { ok: true, data: acc };
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

export async function completePayment(method: PaymentMethod, last4?: string, opts: { annual?: boolean; amount?: number; freeMonths?: number; promo?: { code: string; label: string } } = {}) {
  await wait(1500);
  const payer = getAccount();
  if (payer) send({ channel: "email", kind: "receipt", to: payer.email, subject: "Your MyFlix receipt", body: `Thanks for your payment of ₦${(opts.amount ?? planPrice(payer.planId)).toLocaleString("en-NG")}. Your membership is active.`, link: "/account/billing" });
  const now = new Date();
  const renews = new Date(now);
  renews.setMonth(renews.getMonth() + (opts.annual ? 12 : 1) + (opts.freeMonths ?? 0));
  return update((a) => ({
    ...a,
    billingCycle: opts.annual ? "annual" : "monthly",
    promo: opts.promo,
    payment: { method, last4, paidAt: now.toISOString(), renewsAt: renews.toISOString() },
    billing: [
      { id: `INV-${Date.now().toString().slice(-8)}`, date: now.toISOString(), amount: opts.amount ?? planPrice(a.planId), planId: a.planId ?? "standard", method, last4, status: "Paid" as const },
      ...(a.billing ?? []),
    ],
    devices: a.devices ?? [thisDevice()],
  }));
}

/* ---------------- Account management ---------------- */

const PRICES: Record<string, number> = { mobile: 1500, basic: 2500, standard: 4000, premium: 5500 };
const planPrice = (id?: PlanId) => {
  try {
    const live = JSON.parse(localStorage.getItem("myflix.admin.plans") ?? "[]") as { id: string; price: number }[];
    const p = live.find((x) => x.id === id);
    if (p) return p.price;
  } catch {
    /* defaults */
  }
  return PRICES[id ?? "standard"] ?? 0;
};

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
  send({ channel: "email", kind: "security", to: acc.email, subject: "Your MyFlix password was changed", body: "Your password was changed from Account settings. If this wasn't you, reset it now." });
  return update((a) => ({ ...a, passwordHash }));
}

export async function updatePhone(phone: string) {
  await wait(500);
  return update((a) => ({ ...a, phone }));
}

/** Step 1 of adding a phone: text a 6-digit code to it. */
export async function requestPhoneCode(phone: string): Promise<Result<string>> {
  await wait(500);
  const acc = getAccount();
  const p = normalPhone(phone);
  if (!acc) return { ok: false, error: "Your session has expired. Please sign in again." };
  if (!p) return { ok: false, error: "Enter a valid Nigerian phone number." };
  const other = Object.values(users()).find((a) => a.email !== acc.email && a.phone && normalPhone(a.phone) === p);
  if (other) return { ok: false, error: "Another account already uses this number." };
  const code = issueCode(`verify:${p}`, acc.email);
  send({ channel: "sms", kind: "code", to: prettyPhone(p), subject: "Verify your number", body: `${code} is your MyFlix verification code.` });
  return { ok: true, data: prettyPhone(p) };
}

/** Step 2: confirm the code and save the number. */
export async function confirmPhone(phone: string, code: string): Promise<Result<Account>> {
  await wait(400);
  const p = normalPhone(phone);
  const res = checkCode(`verify:${p}`, code);
  if (!res.ok) return res;
  return update((a) => ({ ...a, phone: p }));
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
  const r = update((a) => ({ ...a, profiles: a.profiles.map((p) => (p.id === profile.id ? profile : p)) }));
  window.dispatchEvent(new Event("myflix:lang")); // display language may have changed
  return r;
}

export async function addCredit(amount: number) {
  await wait(300);
  return update((a) => ({ ...a, credit: (a.credit ?? 0) + amount }));
}

export async function setReferredBy(code: string) {
  return update((a) => ({ ...a, referredBy: code }));
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
  if (typeof window !== "undefined") window.dispatchEvent(new Event("myflix:lang"));
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
