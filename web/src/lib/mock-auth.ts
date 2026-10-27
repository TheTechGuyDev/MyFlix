/**
 * Temporary in-browser auth + account store.
 * Every function is async and returns the same shapes a real backend would,
 * so this file can later be swapped for Supabase without touching the screens.
 * NOTE: demo only. Never store real card data here.
 */
import type { PlanId } from "./plans";

export type PaymentMethod = "card" | "transfer" | "ussd";

export type Profile = {
  id: string;
  name: string;
  avatar: number;
  kids: boolean;
};

export type Account = {
  email: string;
  passwordHash: string;
  createdAt: string;
  planId?: PlanId;
  payment?: { method: PaymentMethod; last4?: string; paidAt: string; renewsAt: string };
  profiles: Profile[];
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
  return update((a) => ({ ...a, payment: { method, last4, paidAt: now.toISOString(), renewsAt: renews.toISOString() } }));
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
