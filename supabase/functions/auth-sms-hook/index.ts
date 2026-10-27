// Supabase Auth "Send SMS" hook: sends phone sign-in / verification codes through Termii (Nigeria).
import { json } from "../_shared/cors.ts";
import { sendSms } from "../_shared/messages.ts";
import { verifyHook } from "../_shared/webhook.ts";

Deno.serve(async (req) => {
  const raw = await req.text();
  if (!(await verifyHook(req, raw, "SEND_SMS_HOOK_SECRET"))) return new Response(JSON.stringify({ error: { http_code: 401, message: "bad signature" } }), { status: 401 });
  const { user, sms } = JSON.parse(raw);
  const ok = await sendSms(user.phone, `${sms.otp} is your MyFlix code. It expires in 10 minutes. Never share it.`, "auth:sms");
  if (!ok) return new Response(JSON.stringify({ error: { http_code: 500, message: "SMS could not be sent." } }), { status: 500 });
  return json({});
});
