import { env, site } from "./cors.ts";
import { admin } from "./supabase.ts";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Branded MyFlix email layout. */
export function layout(heading: string, body: string, cta?: { label: string; url: string }, code?: string) {
  return `<!doctype html><html><body style="margin:0;background:#0a0a0b;font-family:Inter,Segoe UI,Arial,sans-serif;color:#fff">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0b;padding:32px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#141416;border-radius:12px;padding:32px">
<tr><td style="font-size:30px;font-weight:900;letter-spacing:1px">MY<span style="color:#19c37d">FLIX</span></td></tr>
<tr><td style="padding-top:24px;font-size:22px;font-weight:700">${esc(heading)}</td></tr>
<tr><td style="padding-top:12px;font-size:15px;line-height:1.6;color:#c9c9cf">${body}</td></tr>
${code ? `<tr><td style="padding-top:20px"><div style="font-size:34px;font-weight:800;letter-spacing:10px;background:#0a0a0b;border-radius:8px;padding:14px;text-align:center">${esc(code)}</div></td></tr>` : ""}
${cta ? `<tr><td style="padding-top:24px"><a href="${cta.url}" style="display:inline-block;background:#0e9f62;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:6px">${esc(cta.label)}</a></td></tr>` : ""}
<tr><td style="padding-top:28px;font-size:12px;color:#8a8a93">Questions? Reply to this email or visit <a href="${site()}/help/" style="color:#19c37d">the Help Centre</a>.<br/>MyFlix Nigeria</td></tr>
</table></td></tr></table></body></html>`;
}

async function record(channel: string, kind: string, to: string, subject: string, body: string, status: string, providerId?: string, error?: string) {
  await admin.from("outbox").insert({ channel, kind, to_addr: to, subject, body: body.slice(0, 2000), status, provider_id: providerId, error });
}

/** Sends through Resend when RESEND_API_KEY is set; always logged in the admin Delivery log. */
export async function sendEmail(to: string, subject: string, html: string, kind: string, text = "") {
  const key = env("RESEND_API_KEY");
  const summary = text || html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
  if (!key) {
    await record("email", kind, to, subject, summary, "skipped", undefined, "RESEND_API_KEY not set");
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env("EMAIL_FROM") || "MyFlix <onboarding@resend.dev>", to: [to], subject, html, reply_to: env("EMAIL_REPLY_TO") || undefined }),
  });
  const data = await res.json().catch(() => ({}));
  await record("email", kind, to, subject, summary, res.ok ? "sent" : "failed", data.id, res.ok ? undefined : JSON.stringify(data).slice(0, 300));
  return res.ok;
}

/** Nigerian SMS through Termii when TERMII_API_KEY is set. */
export async function sendSms(to: string, message: string, kind: string) {
  const key = env("TERMII_API_KEY");
  const phone = to.replace(/\D/g, "");
  if (!key) {
    await record("sms", kind, phone, "SMS", message, "skipped", undefined, "TERMII_API_KEY not set");
    return false;
  }
  const res = await fetch("https://v3.api.termii.com/api/sms/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: key, to: phone, from: env("TERMII_SENDER_ID") || "MyFlix", sms: message, type: "plain", channel: env("TERMII_CHANNEL") || "dnd" }),
  });
  const data = await res.json().catch(() => ({}));
  await record("sms", kind, phone, "SMS", message, res.ok ? "sent" : "failed", data.message_id, res.ok ? undefined : JSON.stringify(data).slice(0, 300));
  return res.ok;
}

/** In-app notification (shown in the bell on website and app). */
export async function notify(accountId: string | null, head: string, body: string, link?: string, titleId?: string, campaignId?: string) {
  await admin.from("notifications").insert({ account_id: accountId, head, body, link, title_id: titleId, campaign_id: campaignId });
}

export const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;
