// Sends an admin campaign: in-app notifications, email (Resend) or SMS (Termii) to the chosen audience.
import { fail, HttpError, json, serve, site } from "../_shared/cors.ts";
import { admin, audit, requireStaff } from "../_shared/supabase.ts";
import { layout, sendEmail, sendSms } from "../_shared/messages.ts";

type Acc = { id: string; email: string; phone: string | null; plan_id: string | null; status: string; state: string | null; notifications: Record<string, boolean>; created_at: string };

function audienceFilter(a: Acc, audience: string, active: boolean) {
  switch (audience) {
    case "Cancelled in last 90 days": return a.status === "cancelled";
    case "Past due members": return a.status === "past_due";
    case "Signed up, never paid": return a.status === "pending";
    case "Premium members": return active && a.plan_id === "premium";
    case "Mobile plan members": return active && a.plan_id === "mobile";
    case "Lagos members": return active && a.state === "Lagos";
    case "Abuja (FCT) members": return active && a.state === "Abuja (FCT)";
    default: return active;
  }
}

serve(async (req) => {
  const { user, name } = await requireStaff(req, "campaigns");
  const b = await req.json().catch(() => ({}));
  if (b.action !== "send") return fail("Unknown action.");
  const { data: c } = await admin.from("campaigns").select("*").eq("id", b.campaign_id).single();
  if (!c) throw new HttpError(404, "Campaign not found.");
  if (c.status === "sent" || c.status === "sending") throw new HttpError(400, "This campaign was already sent.");
  await admin.from("campaigns").update({ status: "sending" }).eq("id", c.id);

  const { data: accounts } = await admin.from("accounts").select("id, email, phone, plan_id, status, state, notifications, created_at, paid_until").limit(50000);
  const now = Date.now();
  const list = (accounts ?? []).filter((a) => audienceFilter(a as Acc, c.audience, ["active", "cancelled", "past_due"].includes(a.status) && a.paid_until && new Date(a.paid_until).getTime() > now)) as Acc[];
  const link = c.title_id ? `/browse?title=${c.title_id}` : "/browse";
  let reach = 0;

  if (c.channel === "in_app" || c.channel === "push") {
    // One row per member so it only shows to the audience
    const rows = list.filter((a) => c.channel === "in_app" || a.notifications?.push !== false).map((a) => ({ account_id: a.id, head: c.subject, body: c.body, title_id: c.title_id, link, campaign_id: c.id }));
    for (let i = 0; i < rows.length; i += 500) await admin.from("notifications").insert(rows.slice(i, i + 500));
    reach = rows.length;
  } else if (c.channel === "email") {
    const optedIn = list.filter((a) => a.notifications?.offers !== false || c.audience === "Past due members");
    for (const a of optedIn.slice(0, 2000)) {
      if (await sendEmail(a.email, c.subject, layout(c.subject, c.body.replace(/\n/g, "<br/>"), { label: "Watch on MyFlix", url: `${site()}${link}` }) , "campaign")) reach++;
    }
  } else if (c.channel === "sms") {
    for (const a of list.filter((x) => x.phone).slice(0, 2000)) if (await sendSms(a.phone!, `MyFlix: ${c.body}`.slice(0, 160), "campaign")) reach++;
  }

  await admin.from("campaigns").update({ status: "sent", sent_at: new Date().toISOString(), reach }).eq("id", c.id);
  await audit(user.id, name, `Sent ${c.channel} campaign`, `${c.name} (${reach} members)`);
  return json({ ok: true, reach });
});
