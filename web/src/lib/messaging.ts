"use client";

/**
 * Outgoing messages (email, SMS, push). In the demo they are written to a shared outbox that the
 * admin dashboard reads (Campaigns > Delivery log) and shown in an on-screen "demo inbox".
 * With Supabase this becomes an edge function calling an email/SMS provider (e.g. Resend, Termii).
 */
export type Channel = "email" | "sms" | "push";
export type OutMsg = {
  id: string;
  channel: Channel;
  kind: "reset" | "code" | "welcome" | "receipt" | "security" | "campaign" | "tv" | "reminder";
  to: string;
  subject: string;
  body: string;
  link?: string;
  at: string;
};

const KEY = "myflix.outbox";
export const MESSAGE_EVENT = "myflix:message";

const read = <T,>(k: string, f: T): T => {
  try {
    const r = localStorage.getItem(k);
    return r ? (JSON.parse(r) as T) : f;
  } catch {
    return f;
  }
};
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* ignore */
  }
};

export function send(m: Omit<OutMsg, "id" | "at">): OutMsg {
  const msg: OutMsg = { ...m, id: Math.random().toString(36).slice(2, 10), at: new Date().toISOString() };
  write(KEY, [msg, ...read<OutMsg[]>(KEY, [])].slice(0, 300));
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(MESSAGE_EVENT, { detail: msg }));
  return msg;
}

export const outbox = () => read<OutMsg[]>(KEY, []);

/* ---------------- Phone numbers ---------------- */
/** Normalises Nigerian numbers to 234XXXXXXXXXX. Returns "" if invalid. */
export function normalPhone(input: string) {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("0") && d.length === 11) d = "234" + d.slice(1);
  if (d.length === 10 && /^[789]/.test(d)) d = "234" + d;
  return /^234[789]\d{9}$/.test(d) ? d : "";
}
export const prettyPhone = (p: string) => (p.startsWith("234") ? `+234 ${p.slice(3, 6)} ${p.slice(6, 9)} ${p.slice(9)}` : p);
export const isPhoneLike = (s: string) => /^[+\d][\d\s-]{6,}$/.test(s.trim());

/* ---------------- One-time codes & reset tokens ---------------- */
type Code = { code: string; email: string; exp: number; tries: number };
type Token = { email: string; exp: number };

export function issueCode(key: string, email: string) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const all = read<Record<string, Code>>("myflix.codes", {});
  all[key] = { code, email, exp: Date.now() + 10 * 60000, tries: 0 };
  write("myflix.codes", all);
  return code;
}

export function checkCode(key: string, code: string): { ok: true; email: string } | { ok: false; error: string } {
  const all = read<Record<string, Code>>("myflix.codes", {});
  const c = all[key];
  if (!c || c.exp < Date.now()) return { ok: false, error: "That code has expired. Request a new one." };
  if (c.tries >= 5) return { ok: false, error: "Too many attempts. Request a new code." };
  if (c.code !== code.trim()) {
    c.tries += 1;
    write("myflix.codes", all);
    return { ok: false, error: "That code isn't right. Check the message and try again." };
  }
  delete all[key];
  write("myflix.codes", all);
  return { ok: true, email: c.email };
}

export function issueResetToken(email: string) {
  const token = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
  const all = read<Record<string, Token>>("myflix.resets", {});
  all[token] = { email, exp: Date.now() + 3600000 };
  write("myflix.resets", all);
  return token;
}

export function consumeResetToken(token: string, peek = false): string | null {
  const all = read<Record<string, Token>>("myflix.resets", {});
  const t = all[token];
  if (!t || t.exp < Date.now()) return null;
  if (!peek) {
    delete all[token];
    write("myflix.resets", all);
  }
  return t.email;
}

/* ---------------- Browser push notifications ---------------- */
export const pushSupported = () => typeof window !== "undefined" && "Notification" in window;
export const pushPermission = (): NotificationPermission | "unsupported" => (pushSupported() ? Notification.permission : "unsupported");

let swReg: ServiceWorkerRegistration | null = null;
export async function registerSw() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    swReg = await navigator.serviceWorker.register(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/sw.js`);
  } catch {
    swReg = null;
  }
  return swReg;
}

export async function enablePush() {
  if (!pushSupported()) return "unsupported" as const;
  const res = await Notification.requestPermission();
  if (res === "granted") await registerSw();
  return res;
}

/** Shows a system notification (if allowed) and records it in the outbox. */
export async function pushNotify(to: string, title: string, body: string, link?: string, kind: OutMsg["kind"] = "campaign") {
  send({ channel: "push", kind, to, subject: title, body, link });
  if (pushPermission() !== "granted") return;
  const icon = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/favicon.ico`;
  try {
    const reg = swReg ?? (await registerSw());
    if (reg?.showNotification) await reg.showNotification(title, { body, icon, data: { link } });
    else new Notification(title, { body, icon });
  } catch {
    /* some browsers block notifications from pages */
  }
}

/** Sends a push for each admin campaign this member hasn't been notified about yet. */
export function deliverCampaignPush(email: string, notices: { id: string; head: string; body: string; titleId?: string }[]) {
  const seenKey = `myflix.pushed.${email}`;
  const seen = new Set(read<string[]>(seenKey, []));
  const fresh = notices.filter((n) => !seen.has(n.id));
  if (!fresh.length) return;
  fresh.slice(0, 3).forEach((n) => pushNotify(email, n.head, n.body, n.titleId ? `/browse?title=${n.titleId}` : "/browse"));
  write(seenKey, [...seen, ...fresh.map((n) => n.id)]);
}
