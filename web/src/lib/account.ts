"use client";

/**
 * Member accounts on Supabase: sign-up/in, codes, password reset, plans, payments (Paystack),
 * profiles, devices and privacy (export/delete). Reads come from the start-up cache (store.ts).
 */
import type { PlanId } from "./plans";
import { getState, refreshAccount, type DbAccount, type DbProfile, deviceId } from "./store";
import { fn, friendly, sb, siteUrl } from "./supabase";
import { isPhoneLike, normalPhone, prettyPhone } from "./messaging";

export type PaymentMethod = "card" | "transfer" | "ussd" | "bank" | "credit";
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

export type Profile = { id: string; name: string; avatar: number; kids: boolean; settings?: Partial<ProfileSettings>; hasPin?: boolean };

export type BillingRecord = { id: string; date: string; amount: number; planId: PlanId; method: PaymentMethod; last4?: string; status: "Paid" | "Refunded" };
export type Device = { id: string; name: string; location: string; lastUsed: string; current?: boolean; kind?: string };
export type NotificationPrefs = { newArrivals: boolean; reminders: boolean; recommendations: boolean; billing: boolean; offers: boolean; push: boolean };

export type Account = {
  id: string;
  email: string;
  createdAt: string;
  phone?: string;
  planId?: PlanId;
  pendingPlanId?: PlanId;
  status: DbAccount["status"];
  payment?: { method: PaymentMethod; last4?: string; cardType?: string; paidAt: string; renewsAt: string; reusable?: boolean };
  cancelAt?: string;
  notifications?: NotificationPrefs;
  profiles: Profile[];
  suspended?: boolean;
  billingCycle?: "monthly" | "annual";
  credit?: number;
  promo?: { code: string; label?: string };
  referredBy?: string;
  referralCode?: string;
  hasAccess: boolean;
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

export const defaultNotifications: NotificationPrefs = { newArrivals: true, reminders: true, recommendations: true, billing: true, offers: false, push: true };

export const MAX_PROFILES = 5;

export type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };
const ok = <T,>(data: T): Result<T> => ({ ok: true, data });
const err = (e: unknown): { ok: false; error: string } => ({ ok: false, error: translateAuthError(friendly(e)) });

function translateAuthError(m: string) {
  if (/Invalid login credentials/i.test(m)) return "Incorrect email or password. Please try again or reset your password.";
  if (/Email not confirmed/i.test(m)) return "Please confirm your email first. We sent you a link and a code.";
  if (/User already registered/i.test(m)) return "An account with this email already exists. Sign in instead.";
  if (/rate limit|too many/i.test(m)) return "Too many attempts. Please wait a minute and try again.";
  if (/Token has expired|otp_expired|invalid.*token/i.test(m)) return "That code is wrong or has expired. Request a new one.";
  if (/Signups not allowed for otp/i.test(m)) return "We can't find an account with those details.";
  return m;
}

const toProfile = (p: DbProfile): Profile => ({ id: p.id, name: p.name, avatar: p.avatar, kids: p.kids, settings: p.settings as Partial<ProfileSettings>, hasPin: p.has_pin });

/** The signed-in account in the shape the screens use. */
export function getAccount(): Account | null {
  const s = getState();
  const a = s.account;
  if (!a) return null;
  const lastPaid = s.billing?.payments.find((p) => p.status === "success");
  const access = ["active", "cancelled", "past_due"].includes(a.status) && Boolean(a.paid_until && new Date(a.paid_until) > new Date());
  const m = s.billing?.method;
  return {
    id: a.id,
    email: a.email,
    createdAt: a.created_at,
    phone: a.phone ?? undefined,
    planId: a.plan_id ?? a.pending_plan_id ?? undefined,
    pendingPlanId: a.pending_plan_id ?? undefined,
    status: a.status,
    payment: access
      ? { method: (lastPaid?.channel === "bank_transfer" ? "transfer" : (lastPaid?.channel as PaymentMethod)) ?? "card", last4: m?.last4 ?? lastPaid?.last4 ?? undefined, cardType: m?.card_type ?? undefined, paidAt: lastPaid?.paid_at ?? a.created_at, renewsAt: a.paid_until!, reusable: m?.reusable }
      : undefined,
    cancelAt: a.cancel_at ?? undefined,
    notifications: { ...defaultNotifications, ...(a.notifications as Partial<NotificationPrefs>) },
    profiles: s.profiles.map(toProfile),
    suspended: a.status === "suspended",
    billingCycle: a.billing_cycle,
    credit: a.credit,
    promo: a.promo ?? undefined,
    referredBy: a.referred_by ?? undefined,
    referralCode: a.referral_code ?? undefined,
    hasAccess: access,
  };
}

export const getSessionEmail = () => getState().session?.user.email ?? null;

export async function emailExists(email: string) {
  void email; // Not exposed by the backend (prevents account discovery)
  return false;
}

/* ---------------- Sign up / sign in ---------------- */
export async function signUp(email: string, password: string, ref?: string): Promise<Result<{ needsConfirm: boolean }>> {
  const { data, error } = await sb().auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { emailRedirectTo: siteUrl("/signup/plan/"), data: ref ? { ref } : undefined },
  });
  if (error) return err(error);
  if (data.user && data.user.identities?.length === 0) return { ok: false, error: "An account with this email already exists. Sign in instead." };
  await refreshAccount();
  return ok({ needsConfirm: !data.session });
}

export async function verifySignupCode(email: string, code: string): Promise<Result<Account>> {
  const { error } = await sb().auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: "signup" });
  if (error) return err(error);
  await refreshAccount();
  return ok(getAccount()!);
}

export async function resendSignupCode(email: string): Promise<Result> {
  const { error } = await sb().auth.resend({ type: "signup", email: email.trim().toLowerCase(), options: { emailRedirectTo: siteUrl("/signup/plan/") } });
  return error ? err(error) : ok(undefined);
}

export async function signIn(email: string, password: string): Promise<Result<Account>> {
  const { error } = await sb().auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) return err(error);
  const acc = await refreshAccount();
  if (acc?.status === "suspended") {
    await sb().auth.signOut({ scope: "local" });
    await refreshAccount();
    return { ok: false, error: "This account has been suspended. Contact MyFlix support to restore access." };
  }
  await sb().rpc("touch_device", { p_id: deviceId(), p_name: navigator.userAgent.includes("Mobile") ? "Mobile browser" : "Web browser", p_kind: "web" });
  return ok(getAccount()!);
}

export async function signOut() {
  try {
    localStorage.removeItem("myflix.activeProfile");
  } catch {
    /* ignore */
  }
  await sb().auth.signOut({ scope: "local" });
  await refreshAccount();
}

/** "Use a sign-in code": 6-digit code by email, or by SMS to a verified phone. */
export async function requestSignInCode(identifier: string): Promise<Result<{ to: string; channel: "email" | "sms" }>> {
  const phone = isPhoneLike(identifier);
  const { error } = phone
    ? await sb().auth.signInWithOtp({ phone: `+${normalPhone(identifier)}`, options: { shouldCreateUser: false } })
    : await sb().auth.signInWithOtp({ email: identifier.trim().toLowerCase(), options: { shouldCreateUser: false } });
  if (error) return err(error);
  return ok({ to: phone ? prettyPhone(normalPhone(identifier)) : identifier.trim(), channel: phone ? "sms" : "email" });
}

export async function verifySignInCode(identifier: string, code: string): Promise<Result<Account>> {
  const phone = isPhoneLike(identifier);
  const { error } = phone
    ? await sb().auth.verifyOtp({ phone: `+${normalPhone(identifier)}`, token: code.trim(), type: "sms" })
    : await sb().auth.verifyOtp({ email: identifier.trim().toLowerCase(), token: code.trim(), type: "email" });
  if (error) return err(error);
  const acc = await refreshAccount();
  if (acc?.status === "suspended") {
    await signOut();
    return { ok: false, error: "This account has been suspended. Contact MyFlix support to restore access." };
  }
  return ok(getAccount()!);
}

/** Email: sends a reset link. Phone: sends a code (then verifyResetCode signs in to set a new password). */
export async function requestPasswordReset(identifier: string): Promise<Result<{ channel: "email" | "sms" }>> {
  if (isPhoneLike(identifier)) {
    const { error } = await sb().auth.signInWithOtp({ phone: `+${normalPhone(identifier)}`, options: { shouldCreateUser: false } });
    // Same answer whether or not the number exists
    if (error && !/Signups not allowed/i.test(error.message)) return err(error);
    return ok({ channel: "sms" });
  }
  const { error } = await sb().auth.resetPasswordForEmail(identifier.trim().toLowerCase(), { redirectTo: siteUrl("/login/reset/") });
  if (error && /rate/i.test(error.message)) return err(error);
  return ok({ channel: "email" });
}

export async function verifyResetCode(identifier: string, code: string): Promise<Result> {
  const r = isPhoneLike(identifier)
    ? await sb().auth.verifyOtp({ phone: `+${normalPhone(identifier)}`, token: code.trim(), type: "sms" })
    : await sb().auth.verifyOtp({ email: identifier.trim().toLowerCase(), token: code.trim(), type: "recovery" });
  return r.error ? err(r.error) : ok(undefined);
}

/** Sets a new password for the signed-in (recovery) session. */
export async function resetPassword(password: string): Promise<Result<Account | null>> {
  const { error } = await sb().auth.updateUser({ password });
  if (error) return err(error);
  await refreshAccount();
  return ok(getAccount());
}

/* ---------------- Plans & payments ---------------- */
export async function choosePlan(planId: PlanId): Promise<Result> {
  const { error } = await sb().rpc("choose_plan", { p_plan: planId });
  if (error) return err(error);
  await refreshAccount();
  return ok(undefined);
}

export type Quote = { ok: boolean; base: number; discount: number; credit_used: number; free_months: number; amount: number; months: number; promo: { code: string; label: string } | null; promo_error: string | null; error?: string };

export async function quote(planId: string, cycle: "monthly" | "annual", promo?: string): Promise<Quote | null> {
  const { data, error } = await sb().rpc("my_quote", { p_plan: planId, p_cycle: cycle, p_promo: promo || null });
  return error ? null : (data as Quote);
}

/** Starts a Paystack checkout. Returns the URL to send the member to (or done when credit covers it). */
export async function startPayment(opts: { plan: string; cycle: "monthly" | "annual"; promo?: string; returnTo?: string }): Promise<Result<{ url?: string; done?: boolean; reference: string }>> {
  try {
    const r = await fn<{ authorization_url?: string; done?: boolean; reference: string }>("payments", {
      action: "init",
      plan: opts.plan,
      cycle: opts.cycle,
      promo: opts.promo || null,
      callback_url: siteUrl(opts.returnTo ?? "/signup/payment/"),
    });
    if (r.done) await refreshAccount();
    return ok({ url: r.authorization_url, done: r.done, reference: r.reference });
  } catch (e) {
    return err(e);
  }
}

export async function verifyPayment(reference: string): Promise<Result<string>> {
  try {
    const r = await fn<{ status: string; message?: string }>("payments", { action: "verify", reference });
    await refreshAccount();
    return r.status === "success" ? ok("success") : { ok: false, error: r.message ? `Payment not completed: ${r.message}` : "Payment not completed. You can try again." };
  } catch (e) {
    return err(e);
  }
}

export async function changePlanNow(planId: PlanId): Promise<Result<{ when: "now" | "renewal" | "payment"; at?: string }>> {
  const { data, error } = await sb().rpc("change_plan", { p_plan: planId });
  if (error) return err(error);
  await refreshAccount();
  return ok(data as { when: "now" | "renewal" | "payment"; at?: string });
}

export async function cancelMembership(): Promise<Result> {
  const { error } = await sb().rpc("cancel_membership");
  if (error) return err(error);
  await refreshAccount();
  return ok(undefined);
}

export async function restartMembership(): Promise<Result> {
  const { error } = await sb().rpc("restart_membership");
  if (error) return err(error);
  await refreshAccount();
  return ok(undefined);
}

/** Replaces the saved card with a ₦50 card check that is refunded straight away. */
export async function updatePaymentMethod(): Promise<Result<{ url?: string }>> {
  try {
    const r = await fn<{ authorization_url?: string }>("payments", { action: "card", callback_url: siteUrl("/account/payment/") });
    return ok({ url: r.authorization_url });
  } catch (e) {
    return err(e);
  }
}

export function billingHistory(a: Account): BillingRecord[] {
  void a;
  return (getState().billing?.payments ?? []).map((p) => ({
    id: p.reference,
    date: p.paid_at ?? p.created_at,
    amount: p.amount,
    planId: p.plan_id,
    method: (p.channel === "bank_transfer" ? "transfer" : (p.channel as PaymentMethod)) ?? "card",
    last4: p.last4 ?? undefined,
    status: p.status === "refunded" ? "Refunded" : "Paid",
  }));
}

export async function redeemGiftCard(code: string): Promise<Result<number>> {
  const { data, error } = await sb().rpc("redeem_gift", { p_code: code });
  if (error) return err(error);
  await refreshAccount();
  return ok(data as number);
}

export async function setReferredBy(code: string) {
  const a = getState().account;
  if (!a || a.referred_by) return;
  await sb().from("accounts").update({ referred_by: code.toUpperCase() }).eq("id", a.id);
}

/* ---------------- Account settings ---------------- */
async function checkPassword(password: string) {
  const email = getState().session?.user.email;
  if (!email) return false;
  const { error } = await sb().auth.signInWithPassword({ email, password });
  return !error;
}

export async function changeEmail(newEmail: string, password: string): Promise<Result<{ pending: boolean }>> {
  if (!(await checkPassword(password))) return { ok: false, error: "Incorrect password." };
  const { error } = await sb().auth.updateUser({ email: newEmail.trim().toLowerCase() }, { emailRedirectTo: siteUrl("/account/security/") });
  return error ? err(error) : ok({ pending: true });
}

export async function changePassword(current: string, next: string): Promise<Result> {
  if (!(await checkPassword(current))) return { ok: false, error: "Your current password is incorrect." };
  const { error } = await sb().auth.updateUser({ password: next });
  return error ? err(error) : ok(undefined);
}

/** Step 1 of adding a phone: Supabase texts a code to it. */
export async function requestPhoneCode(phone: string): Promise<Result<string>> {
  const p = normalPhone(phone);
  if (!p) return { ok: false, error: "Enter a valid Nigerian phone number." };
  const { error } = await sb().auth.updateUser({ phone: `+${p}` });
  return error ? err(error) : ok(prettyPhone(p));
}

export async function confirmPhone(phone: string, code: string): Promise<Result> {
  const { error } = await sb().auth.verifyOtp({ phone: `+${normalPhone(phone)}`, token: code.trim(), type: "phone_change" });
  if (error) return err(error);
  await refreshAccount();
  return ok(undefined);
}

export async function updateNotifications(n: NotificationPrefs): Promise<Result> {
  const a = getState().account;
  if (!a) return { ok: false, error: "Please sign in." };
  const { error } = await sb().from("accounts").update({ notifications: n }).eq("id", a.id);
  if (error) return err(error);
  await refreshAccount();
  return ok(undefined);
}

export async function signOutAllDevices() {
  const a = getState().account;
  if (a) await sb().from("devices").update({ revoked_at: new Date().toISOString() }).eq("account_id", a.id);
  await sb().auth.signOut({ scope: "global" });
  await refreshAccount();
}

export function devicesOf(a: Account): Device[] {
  void a;
  const me = deviceId();
  return getState().devices.map((d) => ({ id: d.id, name: d.name, kind: d.kind, location: d.location ?? "Nigeria", lastUsed: d.last_seen, current: d.id === me }));
}

export async function removeDevice(id: string): Promise<Result> {
  const { error } = await sb().from("devices").update({ revoked_at: new Date().toISOString() }).eq("id", id);
  if (error) return err(error);
  await refreshAccount();
  return ok(undefined);
}

/* ---------------- Profiles ---------------- */
const dbSettings = (p: Profile) => {
  const s = { ...(p.settings ?? {}) };
  delete s.pin;
  return s;
};

export async function updateProfile(profile: Profile): Promise<Result> {
  const { error } = await sb().from("viewer_profiles").update({ name: profile.name, avatar: profile.avatar, kids: profile.kids, settings: dbSettings(profile) }).eq("id", profile.id);
  if (error) return err(error);
  if (profile.settings && "pin" in profile.settings) {
    const { error: e2 } = await sb().rpc("set_profile_pin", { pid: profile.id, pin: profile.settings.pin ?? null });
    if (e2) return err(e2);
  }
  await refreshAccount();
  window.dispatchEvent(new Event("myflix:lang"));
  return ok(undefined);
}

/** Saves the whole profile list: adds new ones, updates changed ones and deletes removed ones. */
export async function saveProfiles(profiles: Profile[]): Promise<Result> {
  const s = getState();
  const a = s.account;
  if (!a) return { ok: false, error: "Please sign in." };
  const existing = new Set(s.profiles.map((p) => p.id));
  const keep = new Set(profiles.map((p) => p.id));
  for (const old of s.profiles) if (!keep.has(old.id)) await sb().from("viewer_profiles").delete().eq("id", old.id);
  for (const [i, p] of profiles.slice(0, MAX_PROFILES).entries()) {
    const row = { name: p.name.trim().slice(0, 30) || "Profile", avatar: p.avatar, kids: p.kids, settings: dbSettings(p), sort: i };
    const { error } = existing.has(p.id)
      ? await sb().from("viewer_profiles").update(row).eq("id", p.id)
      : await sb().from("viewer_profiles").insert({ ...row, account_id: a.id });
    if (error) return err(error);
  }
  await refreshAccount();
  return ok(undefined);
}

export async function checkProfilePin(profileId: string, pin: string) {
  const { data } = await sb().rpc("check_profile_pin", { pid: profileId, pin });
  return data === true;
}

export function setActiveProfile(id: string) {
  try {
    localStorage.setItem("myflix.activeProfile", id);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event("myflix:lang"));
}

export function getActiveProfileId(): string | null {
  try {
    return localStorage.getItem("myflix.activeProfile");
  } catch {
    return null;
  }
}

/* ---------------- Privacy ---------------- */
export async function exportMyData(): Promise<Result<Blob>> {
  try {
    const data = await fn("account", { action: "export" });
    return ok(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  } catch (e) {
    return err(e);
  }
}

export async function deleteMyAccount(confirmEmail: string): Promise<Result> {
  try {
    await fn("account", { action: "delete", confirm: confirmEmail });
    try {
      localStorage.removeItem("myflix.activeProfile");
    } catch {
      /* ignore */
    }
    await sb().auth.signOut({ scope: "local" });
    await refreshAccount();
    return ok(undefined);
  } catch (e) {
    return err(e);
  }
}

/** Where a signed-in member should go next to finish setup. */
export function nextStep(acc: Account | null): string {
  if (!acc) return "/signup";
  if (!acc.planId) return "/signup/plan";
  if (!acc.hasAccess) return "/signup/payment";
  if (acc.profiles.length === 0) return "/signup/profiles";
  return "/profiles";
}

export const newId = () => Math.random().toString(36).slice(2, 10);
