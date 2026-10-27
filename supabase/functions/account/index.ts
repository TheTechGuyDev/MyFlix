// Member self-service: download a copy of your data, or permanently delete your account.
import { fail, HttpError, json, serve } from "../_shared/cors.ts";
import { admin, requireUser } from "../_shared/supabase.ts";
import { layout, sendEmail } from "../_shared/messages.ts";

serve(async (req) => {
  const user = await requireUser(req);
  const b = await req.json().catch(() => ({}));

  if (b.action === "export") {
    const uid = user.id;
    const { data: profiles } = await admin.from("viewer_profiles").select("id, name, avatar, kids, settings, created_at").eq("account_id", uid);
    const pids = (profiles ?? []).map((p) => p.id);
    const by = async (table: string) => (pids.length ? (await admin.from(table).select("*").in("profile_id", pids)).data ?? [] : []);
    const [account, payments, devices, tickets] = await Promise.all([
      admin.from("accounts").select("email, phone, plan_id, billing_cycle, status, paid_until, cancel_at, credit, referral_code, referred_by, notifications, created_at").eq("id", uid).single(),
      admin.from("payments").select("reference, amount, currency, status, plan_id, cycle, channel, last4, paid_at, created_at").eq("account_id", uid),
      admin.from("devices").select("name, kind, last_seen, created_at, revoked_at").eq("account_id", uid),
      admin.from("tickets").select("id, subject, category, status, created_at, ticket_messages(from_staff, author, body, created_at, internal)").eq("account_id", uid),
    ]);
    const data = {
      exported_at: new Date().toISOString(),
      account: account.data,
      profiles,
      my_list: await by("my_list"),
      ratings: await by("ratings"),
      progress: await by("progress"),
      viewing_activity: await by("activity"),
      usage: await by("usage_daily"),
      reminders: await by("reminders"),
      payments: payments.data,
      devices: devices.data,
      support_tickets: (tickets.data ?? []).map((t) => ({ ...t, ticket_messages: (t.ticket_messages as { internal: boolean }[]).filter((m) => !m.internal) })),
    };
    return json(data);
  }

  if (b.action === "delete") {
    if (String(b.confirm ?? "").trim().toLowerCase() !== (user.email ?? "").toLowerCase()) throw new HttpError(400, "Type your email address to confirm.");
    const { data: acc } = await admin.from("accounts").select("email").eq("id", user.id).single();
    // Payment records are kept (without the link to your account) because tax law requires it.
    await admin.from("payment_methods").delete().eq("account_id", user.id);
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw new HttpError(500, "We couldn't delete your account. Contact support.");
    if (acc?.email) await sendEmail(acc.email, "Your MyFlix account was deleted", layout("Account deleted", "Your MyFlix account, profiles and viewing history have been permanently deleted. Receipts are kept for accounting as the law requires. You're welcome back any time."), "security");
    return json({ ok: true });
  }

  return fail("Unknown action.");
});
