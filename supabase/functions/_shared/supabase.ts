import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2.49.4";
import { env, HttpError } from "./cors.ts";

/** Works with both legacy (anon / service_role) and new (publishable / secret) API keys. */
function key(legacy: string, modern: string) {
  const v = env(legacy);
  if (v) return v;
  try {
    const parsed = JSON.parse(env(modern) || "null");
    if (Array.isArray(parsed)) return String(parsed[0] ?? "");
    if (parsed && typeof parsed === "object") return String(Object.values(parsed)[0] ?? "");
  } catch {
    /* not JSON */
  }
  return env(modern);
}
export const SERVICE_KEY = key("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEYS");
export const PUBLIC_KEY = key("SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEYS");

/** Service-role client: bypasses Row Level Security. Only use after checking permissions. */
export const admin: SupabaseClient = createClient(env("SUPABASE_URL"), SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Client acting as the caller, so RLS and auth.uid() apply. */
export function asUser(req: Request): SupabaseClient {
  return createClient(env("SUPABASE_URL"), PUBLIC_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
}

export async function requireUser(req: Request): Promise<User> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "Please sign in.");
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Your session has expired. Please sign in again.");
  return data.user;
}

/** Staff member with the section permission, signed in with two-step verification. */
export async function requireStaff(req: Request, section: string) {
  const user = await requireUser(req);
  const { data: ok, error } = await asUser(req).rpc("staff_can", { section });
  if (error || !ok) throw new HttpError(403, "You don't have access to this, or two-step sign-in is needed.");
  const { data: s } = await admin.from("staff").select("name").eq("user_id", user.id).single();
  return { user, name: (s?.name as string) ?? user.email ?? "Staff" };
}

export async function audit(staffId: string | null, staffName: string, action: string, target: string) {
  await admin.from("audit_log").insert({ staff_id: staffId, staff_name: staffName, action, target });
}

export async function settings(): Promise<Record<string, unknown>> {
  const { data } = await admin.from("site_settings").select("data").eq("id", 1).single();
  return (data?.data as Record<string, unknown>) ?? {};
}
