"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import Avatar from "@/components/auth/Avatar";
import { Alert, Field, PrimaryButton, validateEmail, validatePassword } from "@/components/auth/ui";
import {
  changeEmail,
  changePassword,
  defaultNotifications,
  devicesOf,
  removeDevice,
  settingsOf,
  signOutAllDevices,
  updateNotifications,
  updatePhone,
  updateProfile,
  type DataUsage,
  type Maturity,
  type NotificationPrefs,
  type ProfileSettings,
} from "@/lib/mock-auth";
import { languages } from "@/lib/landing-data";
import { Card, LinkRow, PageTitle, Toggle, fmtDate, useAccountCtx } from "./AccountShell";

/* ---------------- Security ---------------- */
export function Security() {
  const { account, refresh, toast } = useAccountCtx();
  const router = useRouter();
  const [mode, setMode] = useState<null | "email" | "password" | "phone">(null);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [c, setC] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const open = (m: typeof mode) => {
    setMode(m);
    setA(m === "phone" ? account.phone ?? "" : "");
    setB("");
    setC("");
    setErr("");
  };

  const submit = async () => {
    setErr("");
    if (mode === "email") {
      const e = validateEmail(a);
      if (e) return setErr(e);
      if (!b) return setErr("Enter your password to confirm.");
      setLoading(true);
      const r = await changeEmail(a, b);
      setLoading(false);
      if (!r.ok) return setErr(r.error);
      toast("Email updated.");
    } else if (mode === "password") {
      const e = validatePassword(b);
      if (!a) return setErr("Enter your current password.");
      if (e) return setErr(e);
      if (b !== c) return setErr("New passwords don't match.");
      setLoading(true);
      const r = await changePassword(a, b);
      setLoading(false);
      if (!r.ok) return setErr(r.error);
      toast("Password changed.");
    } else if (mode === "phone") {
      if (!/^(\+234|0)[789][01]\d{8}$/.test(a.replace(/\s/g, ""))) return setErr("Enter a valid Nigerian phone number.");
      setLoading(true);
      await updatePhone(a.replace(/\s/g, ""));
      setLoading(false);
      toast("Phone number saved.");
    }
    refresh();
    setMode(null);
  };

  return (
    <div className="space-y-6">
      <PageTitle title="Security" sub="Manage how you sign in to MyFlix." />
      <Card>
        <LinkRow label="Email" sub={account.email} onClick={() => open("email")} />
        <LinkRow label="Password" sub="••••••••" onClick={() => open("password")} />
        <LinkRow label="Mobile phone" sub={account.phone ?? "Add a phone number for account recovery"} onClick={() => open("phone")} />
      </Card>

      {mode && (
        <Card title={mode === "email" ? "Change email" : mode === "password" ? "Change password" : "Mobile phone"}>
          <div className="max-w-md space-y-3">
            {err && <Alert>{err}</Alert>}
            {mode === "email" && (
              <>
                <Field label="New email" type="email" value={a} onChange={(e) => setA(e.target.value)} />
                <Field label="Current password" revealable value={b} onChange={(e) => setB(e.target.value)} />
              </>
            )}
            {mode === "password" && (
              <>
                <Field label="Current password" revealable value={a} onChange={(e) => setA(e.target.value)} />
                <Field label="New password (6-60 characters)" revealable value={b} onChange={(e) => setB(e.target.value)} />
                <Field label="Re-enter new password" revealable value={c} onChange={(e) => setC(e.target.value)} />
              </>
            )}
            {mode === "phone" && <Field label="Phone number (e.g. 0803 123 4567)" type="tel" value={a} onChange={(e) => setA(e.target.value)} />}
            <div className="flex gap-3 pt-2">
              <PrimaryButton onClick={submit} loading={loading} className="!h-11 !w-32 !text-base">Save</PrimaryButton>
              <button onClick={() => setMode(null)} className="h-11 rounded border border-neutral-400 px-5 font-semibold">Cancel</button>
            </div>
          </div>
        </Card>
      )}

      <Card title="Sign out of all devices">
        <p className="text-sm text-neutral-600">Signs MyFlix out on every TV, phone, tablet and computer, including this one. It can take up to 8 hours to apply everywhere.</p>
        <button
          onClick={async () => {
            await signOutAllDevices();
            router.push("/login");
          }}
          className="mt-4 h-11 rounded border border-neutral-900 px-5 font-semibold hover:bg-neutral-900 hover:text-white"
        >
          Sign out of all devices
        </button>
      </Card>
    </div>
  );
}

/* ---------------- Devices ---------------- */
export function Devices() {
  const { account, refresh, toast } = useAccountCtx();
  const devices = devicesOf(account);
  return (
    <div className="space-y-6">
      <PageTitle title="Devices" sub="Devices that recently used your account." />
      <Card>
        {devices.map((d) => (
          <div key={d.id} className="flex items-center gap-4 border-t border-neutral-200 py-4 first:border-t-0">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-neutral-100">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={/TV/.test(d.name) ? "M3 5h18v11H3zM8 20h8" : /Android|iOS/.test(d.name) ? "M7 3h10v18H7zM11 18h2" : "M4 5h16v10H4zM2 19h20"} /></svg>
            </span>
            <span className="flex-1">
              <span className="block font-semibold">{d.name} {d.current && <span className="ml-1 rounded bg-brand/10 px-1.5 py-0.5 text-xs text-brand">This device</span>}</span>
              <span className="block text-sm text-neutral-500">{d.location} · Last used {fmtDate(d.lastUsed)}</span>
            </span>
            {!d.current && (
              <button
                onClick={async () => {
                  await removeDevice(d.id);
                  refresh();
                  toast(`${d.name} signed out.`);
                }}
                className="text-sm font-semibold text-danger hover:underline"
              >
                Sign out
              </button>
            )}
          </div>
        ))}
      </Card>
      <Link href="/account/security" className="inline-block text-sm font-semibold text-brand hover:underline">Sign out of all devices</Link>
    </div>
  );
}

/* ---------------- Notifications ---------------- */
export function Notifications() {
  const { account, refresh, toast } = useAccountCtx();
  const [n, setN] = useState<NotificationPrefs>(account.notifications ?? defaultNotifications);
  const set = async (k: keyof NotificationPrefs, v: boolean) => {
    const next = { ...n, [k]: v };
    setN(next);
    await updateNotifications(next);
    refresh();
    toast("Preferences saved.");
  };
  return (
    <div className="space-y-6">
      <PageTitle title="Notifications" back="/account" sub={`Emails go to ${account.email}`} />
      <Card title="Email">
        <Toggle on={n.newArrivals} onChange={(v) => set("newArrivals", v)} label="New arrivals" sub="New titles and seasons added to MyFlix" />
        <Toggle on={n.reminders} onChange={(v) => set("reminders", v)} label="Reminders" sub="When a title you asked to be reminded about is available" />
        <Toggle on={n.recommendations} onChange={(v) => set("recommendations", v)} label="Recommendations" sub="Picks based on what you watch" />
        <Toggle on={n.offers} onChange={(v) => set("offers", v)} label="Special offers" sub="Promotions and MyFlix news" />
        <Toggle on={n.billing} onChange={(v) => set("billing", v)} label="Billing and account" sub="Receipts, payment issues and security alerts" />
      </Card>
      <Card title="Push notifications">
        <Toggle on={n.push} onChange={(v) => set("push", v)} label="Allow push notifications" sub="On phones and tablets with the MyFlix app" />
      </Card>
    </div>
  );
}

/* ---------------- Profiles list ---------------- */
export function ProfilesList() {
  const { account } = useAccountCtx();
  return (
    <div className="space-y-6">
      <PageTitle title="Profiles" sub="Parental controls and settings for each profile." />
      <Card>
        {account.profiles.map((p) => {
          const s = settingsOf(p);
          return (
            <Link key={p.id} href={`/account/profile?id=${p.id}`} className="flex items-center gap-4 border-t border-neutral-200 py-3 first:border-t-0 hover:bg-neutral-50">
              <Avatar index={p.avatar} kids={p.kids} className="h-12 w-12" />
              <span className="flex-1">
                <span className="block font-semibold">{p.name} {s.pin && <span className="ml-1 text-xs text-neutral-500">🔒 PIN</span>}</span>
                <span className="block text-sm text-neutral-500">{s.language} · Maturity {s.maturity} · Data {s.dataUsage}</span>
              </span>
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-neutral-400" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 5 7 7-7 7" /></svg>
            </Link>
          );
        })}
      </Card>
      <Link href="/profiles" className="inline-block text-sm font-semibold text-brand hover:underline">Add or remove profiles</Link>
    </div>
  );
}

/* ---------------- Single profile settings ---------------- */
const MATURITIES: { id: Maturity; label: string }[] = [
  { id: "All", label: "All ages" },
  { id: "7+", label: "7+ Older kids" },
  { id: "13+", label: "13+ Teens" },
  { id: "16+", label: "16+ Young adults" },
  { id: "18+", label: "18+ Adults (all titles)" },
];
const DATA: { id: DataUsage; label: string; sub: string }[] = [
  { id: "auto", label: "Auto", sub: "Best quality for your connection" },
  { id: "saver", label: "Data Saver", sub: "About 0.3 GB per hour" },
  { id: "hd", label: "HD", sub: "Up to 3 GB per hour" },
  { id: "4k", label: "Maximum (4K)", sub: "Up to 7 GB per hour, Premium plan" },
];

export function ProfileSettingsPage() {
  const { account, refresh, toast } = useAccountCtx();
  const params = useSearchParams();
  const profile = account.profiles.find((p) => p.id === params.get("id"));
  const [s, setS] = useState<ProfileSettings | null>(profile ? settingsOf(profile) : null);
  const [pinOn, setPinOn] = useState(Boolean(profile?.settings?.pin));
  const [pin, setPin] = useState(profile?.settings?.pin ?? "");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  if (!profile || !s) return <PageTitle title="Profile not found" back="/account/profiles" />;
  const patch = (p: Partial<ProfileSettings>) => setS({ ...s, ...p });

  const save = async () => {
    if (pinOn && !/^\d{4}$/.test(pin)) return setErr("Your PIN must be 4 digits.");
    setErr("");
    setLoading(true);
    await updateProfile({ ...profile, settings: { ...s, pin: pinOn ? pin : undefined } });
    setLoading(false);
    refresh();
    toast(`${profile.name}'s settings saved.`);
  };

  const radio = "flex cursor-pointer items-start gap-3 border-t border-neutral-200 py-3 first:border-t-0";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar index={profile.avatar} kids={profile.kids} className="h-16 w-16" />
        <PageTitle title={profile.name} back="/account/profiles" sub={profile.kids ? "Kids profile" : "Profile settings"} />
      </div>

      <Card title="Language">
        <select value={s.language} onChange={(e) => patch({ language: e.target.value })} className="h-12 w-full max-w-sm rounded border border-neutral-400 bg-white px-3">
          {languages.map((l) => <option key={l}>{l}</option>)}
        </select>
        <p className="mt-2 text-sm text-neutral-500">Used for the app and as the default audio and subtitle language where available.</p>
      </Card>

      <Card title="Viewing restrictions">
        <p className="mb-2 text-sm text-neutral-500">Only show titles rated:</p>
        {MATURITIES.filter((m) => !profile.kids || ["All", "7+"].includes(m.id)).map((m) => (
          <label key={m.id} className={radio}>
            <input type="radio" name="maturity" checked={s.maturity === m.id} onChange={() => patch({ maturity: m.id })} className="mt-1 accent-brand" />
            <span className="font-semibold">{m.label}</span>
          </label>
        ))}
      </Card>

      <Card title="Profile lock">
        <Toggle on={pinOn} onChange={setPinOn} label="Require a PIN to open this profile" sub="Stops others in your home from using this profile" />
        {pinOn && (
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            placeholder="4-digit PIN"
            aria-label="4-digit PIN"
            className="mt-2 h-12 w-40 rounded border border-neutral-400 px-3 text-center text-2xl tracking-[0.5em]"
          />
        )}
      </Card>

      <Card title="Playback">
        <Toggle on={s.autoplayNext} onChange={(v) => patch({ autoplayNext: v })} label="Autoplay next episode" sub="Play the next episode automatically on all devices" />
        <Toggle on={s.autoplayPreviews} onChange={(v) => patch({ autoplayPreviews: v })} label="Autoplay previews while browsing" />
        <p className="mb-1 mt-4 font-semibold">Data usage per screen</p>
        {DATA.map((d) => (
          <label key={d.id} className={radio}>
            <input type="radio" name="data" checked={s.dataUsage === d.id} onChange={() => patch({ dataUsage: d.id })} className="mt-1 accent-brand" />
            <span><span className="block font-semibold">{d.label}</span><span className="block text-sm text-neutral-500">{d.sub}</span></span>
          </label>
        ))}
      </Card>

      <Card title="Subtitle appearance">
        <div className="mb-4 flex h-24 items-end justify-center rounded-lg bg-gradient-to-br from-neutral-700 to-neutral-900 pb-4">
          <span
            className={`text-white ${s.subtitleSize === "small" ? "text-sm" : s.subtitleSize === "large" ? "text-2xl" : "text-lg"} ${s.subtitleBg === "box" ? "bg-black/80 px-2" : ""}`}
            style={s.subtitleBg === "shadow" ? { textShadow: "0 0 4px #000, 0 0 4px #000" } : undefined}
          >
            This is how your subtitles will look.
          </span>
        </div>
        <div className="flex flex-wrap gap-6">
          <label className="text-sm">Size
            <select value={s.subtitleSize} onChange={(e) => patch({ subtitleSize: e.target.value as ProfileSettings["subtitleSize"] })} className="ml-2 h-10 rounded border border-neutral-400 bg-white px-2">
              <option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option>
            </select>
          </label>
          <label className="text-sm">Background
            <select value={s.subtitleBg} onChange={(e) => patch({ subtitleBg: e.target.value as ProfileSettings["subtitleBg"] })} className="ml-2 h-10 rounded border border-neutral-400 bg-white px-2">
              <option value="none">None</option><option value="shadow">Drop shadow</option><option value="box">Box</option>
            </select>
          </label>
        </div>
      </Card>

      {err && <Alert>{err}</Alert>}
      <PrimaryButton onClick={save} loading={loading} className="!h-12 !text-base sm:!w-48">Save</PrimaryButton>
    </div>
  );
}
