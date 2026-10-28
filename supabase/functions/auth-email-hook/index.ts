// Supabase Auth "Send Email" hook: branded MyFlix emails for sign-up, sign-in codes, resets and changes.
import { json, site } from "../_shared/cors.ts";
import { layout, sendEmail } from "../_shared/messages.ts";
import { verifyHook } from "../_shared/webhook.ts";

Deno.serve(async (req) => {
  const raw = await req.text();
  if (!(await verifyHook(req, raw, "SEND_EMAIL_HOOK_SECRET"))) return new Response(JSON.stringify({ error: { http_code: 401, message: "bad signature" } }), { status: 401 });
  const { user, email_data: d } = JSON.parse(raw);
  // Links open our own confirm page, which verifies the token there. This works on any device or browser,
  // unlike the default link that only works in the browser that asked for it.
  const verify = (hash: string, type: string) =>
    type === "invite" ? `${site()}/admin/login/?token_hash=${encodeURIComponent(hash)}&type=invite` : `${site()}/auth/confirm/?token_hash=${encodeURIComponent(hash)}&type=${type}`;

  const to = d.email_action_type === "email_change" && user.new_email ? user.new_email : user.email;
  let subject = "MyFlix";
  let html = "";
  switch (d.email_action_type) {
    case "signup":
      subject = "Confirm your MyFlix email";
      html = layout("Confirm your email", "Enter this code in MyFlix, or tap the button, to confirm your email and finish signing up.", { label: "Confirm email", url: verify(d.token_hash, "signup") }, d.token);
      break;
    case "magiclink":
      subject = `${d.token} is your MyFlix sign-in code`;
      html = layout("Your sign-in code", "Enter this code to sign in. It expires in 10 minutes. Never share it with anyone, including MyFlix staff.", { label: "Or sign in with one tap", url: verify(d.token_hash, "magiclink") }, d.token);
      break;
    case "recovery":
      subject = "Reset your MyFlix password";
      html = layout("Reset your password", "We got a request to reset your password. Tap the button within 1 hour. If this wasn't you, you can ignore this email.", { label: "Reset password", url: verify(d.token_hash, "recovery") }, d.token);
      break;
    case "invite":
      subject = "You're invited to MyFlix";
      html = layout("You're invited", "Tap the button to set your password and get started.", { label: "Accept invite", url: verify(d.token_hash, "invite") });
      break;
    case "email_change":
      subject = "Confirm your new MyFlix email";
      html = layout("Confirm your new email", "Confirm this address to finish changing the email on your MyFlix account.", { label: "Confirm new email", url: verify(d.token_hash_new || d.token_hash, "email_change") }, d.token_new || d.token);
      break;
    case "reauthentication":
      subject = "Your MyFlix verification code";
      html = layout("Confirm it's you", "Enter this code to continue.", undefined, d.token);
      break;
    default:
      html = layout("MyFlix", "Use this code to continue.", undefined, d.token);
  }
  const ok = await sendEmail(to, subject, html, `auth:${d.email_action_type}`);
  if (!ok) return new Response(JSON.stringify({ error: { http_code: 500, message: "Email could not be sent." } }), { status: 500 });
  return json({});
});
