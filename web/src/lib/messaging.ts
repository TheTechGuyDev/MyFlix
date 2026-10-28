"use client";

/** Phone number helpers and browser notifications for MyFlix notifications. */
import { sb } from "./supabase";

/* ---------------- Phone numbers ---------------- */
/** Normalises Nigerian numbers to 234XXXXXXXXXX. Returns "" if invalid. */
export function normalPhone(input: string) {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("0") && d.length === 11) d = "234" + d.slice(1);
  if (d.length === 10 && /^[789]/.test(d)) d = "234" + d;
  return /^234[789]\d{9}$/.test(d) ? d : "";
}
export const prettyPhone = (p: string) => {
  const d = p.replace(/\D/g, "");
  return d.startsWith("234") && d.length === 13 ? `+234 ${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9)}` : p;
};
export const isPhoneLike = (s: string) => /^[+\d][\d\s-]{6,}$/.test(s.trim());

/* ---------------- Notifications (bell + browser notifications) ---------------- */
export type Notice = { id: number; head: string; body: string; title_id: string | null; link: string | null; created_at: string };

export async function fetchNotices(): Promise<Notice[]> {
  const { data } = await sb().from("notifications").select("id, head, body, title_id, link, created_at").order("created_at", { ascending: false }).limit(30);
  return (data as Notice[]) ?? [];
}

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

export async function showSystemNotification(title: string, body: string, link?: string) {
  if (pushPermission() !== "granted") return;
  const icon = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/favicon.ico`;
  try {
    const reg = swReg ?? (await registerSw());
    if (reg?.showNotification) await reg.showNotification(title, { body, icon, data: { link } });
    else new Notification(title, { body, icon });
  } catch {
    /* blocked */
  }
}

/** Shows a system notification for each new MyFlix notification since this browser last checked. */
export async function deliverNewNotices(accountId: string, enabled: boolean) {
  const notices = await fetchNotices();
  const key = `myflix.seenNotice.${accountId}`;
  let last = 0;
  try {
    last = Number(localStorage.getItem(key) ?? "0");
  } catch {
    /* ignore */
  }
  const fresh = notices.filter((n) => n.id > last);
  if (notices.length) {
    try {
      localStorage.setItem(key, String(notices[0].id));
    } catch {
      /* ignore */
    }
  }
  if (enabled && last > 0) for (const n of fresh.slice(0, 3)) await showSystemNotification(n.head, n.body, n.link ?? (n.title_id ? `/browse?title=${n.title_id}` : "/browse"));
  return notices;
}
