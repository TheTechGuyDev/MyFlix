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
  confirmPhone,
  deleteMyAccount,
  exportMyData,
  requestPhoneCode,
  updateProfile,
  type DataUsage,
  type Maturity,
  type NotificationPrefs,
  type ProfileSettings,
} from "@/lib/account";
import { languages } from "@/lib/landing-data";
import { enablePush, showSystemNotification, pushPermission, prettyPhone } from "@/lib/messaging";
import { siteSettings } from "@/lib/site-settings";
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
  const [codeSentTo, setCodeSentTo] = useState("");

  const open = (m: typeof mode) => {
    setMode(m);
    setCodeSentTo("");
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
      toast(`Check ${a} and confirm the change. Your email updates once you do.`);
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
      setLoading(true);
      if (!codeSentTo) {
        const r = await requestPhoneCode(a);
        setLoading(false);
        if (!r.ok) return setErr(r.error);
        setCodeSentTo(r.data);
        return;
      }
      const r = await confirmPhone(a, b);
      setLoading(false);
      if (!r.ok) return setErr(r.error);
      toast("Phone number verified. You can now sign in with a code sent to it.");
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
        {siteSettings().smsEnabled ? (
          <LinkRow label="Mobile phone" sub={account.phone ? `${prettyPhone(account.phone)} · Verified` : "Add a phone number to sign in with SMS codes and recover your account"} onClick={() => open("phone")} />
        ) : (
          account.phone && <LinkRow label="Mobile phone" sub={`${prettyPhone(account.phone)} · Verified`} onClick={() => undefined} />
        )}
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
            {mode === "phone" && (
              <>
                <Field label="Phone number (e.g. 0803 123 4567)" type="tel" value={a} disabled={Boolean(codeSentTo)} onChange={(e) => setA(e.target.value)} />
                {codeSentTo && (
                  <>
                    <p className="text-sm text-neutral-600">We texted a 6-digit code to {codeSentTo}.</p>
                    <Field label="6-digit code" inputMode="numeric" maxLength={6} value={b} onChange={(e) => setB(e.target.value.replace(/\D/g, ""))} />
                  </>
                )}
              </>
            )}
            <div className="flex gap-3 pt-2">
              <PrimaryButton onClick={submit} loading={loading} className="!h-11 !w-32 !text-base">{mode === "phone" ? (codeSentTo ? "Verify" : "Send code") : "Save"}</PrimaryButton>
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

/* ---------------- Privacy & data ---------------- */
export function Privacy() {
  const { account, toast } = useAccountCtx();
  const router = useRouter();
  const [busy, setBusy] = useState<"" | "export" | "delete">("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");

  const download = async () => {
    setBusy("export");
    const r = await exportMyData();
    setBusy("");
    if (!r.ok) return toast(r.error);
    const url = URL.createObjectURL(r.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `myflix-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const remove = async () => {
    setErr("");
    setBusy("delete");
    const r = await deleteMyAccount(confirm);
    setBusy("");
    if (!r.ok) return setErr(r.error);
    router.replace("/?deleted=1");
  };

  return (
    <div className="space-y-6">
      <PageTitle title="Privacy & data" sub="See what MyFlix keeps about you, download it, or delete your account." />
      <Card title="Download your data">
        <p className="text-sm text-neutral-600">A file with your account details, profiles, My List, ratings, viewing activity, payments, devices and support messages.</p>
        <PrimaryButton onClick={download} loading={busy === "export"} className="mt-4 !h-11 !w-auto !px-6 !text-base">Download my data</PrimaryButton>
      </Card>
      <Card title="Delete your account">
        <ul className="space-y-1 text-sm text-neutral-600">
          <li>• Your account, profiles, lists, ratings and viewing history are deleted permanently.</li>
          <li>• Any time left on your membership ends now and isn&apos;t refunded.</li>
          <li>• Receipts are kept without your details because accounting law requires it.</li>
        </ul>
        <Field className="mt-4 max-w-md" label={`Type ${account.email} to confirm`} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {err && <p className="mt-2 text-sm text-danger">{err}</p>}
        <button
          onClick={remove}
          disabled={busy === "delete" || confirm.trim().toLowerCase() !== account.email.toLowerCase()}
          className="mt-4 h-11 rounded bg-danger px-6 font-semibold text-white hover:opacity-90 disabled:opacity-40"
        >
          {busy === "delete" ? "Deleting…" : "Delete my account"}
        </button>
      </Card>
      <p className="text-sm text-neutral-500">Read our <Link href="/privacy" className="font-semibold text-brand hover:underline">Privacy Policy</Link> for how we use your information.</p>
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
        <Toggle on={n.push} onChange={(v) => set("push", v)} label="Allow push notifications" sub="On this browser and on phones and tablets with the MyFlix app" />
        <BrowserPush email={account.email} />
      </Card>
    </div>
  );
}

function BrowserPush({ email }: { email: string }) {
  void email;
  const [perm, setPerm] = useState(() => pushPermission());
  return (
    <div className="mt-4 rounded-lg bg-neutral-100 p-4 text-sm">
      <p className="font-semibold">This browser</p>
      <p className="mt-1 text-neutral-600">
        {perm === "granted" ? "Notifications are on. You'll hear about new episodes, reminders and account alerts." : perm === "denied" ? "Notifications are blocked. Allow them for this site in your browser settings." : perm === "unsupported" ? "This browser doesn't support notifications." : "Turn on notifications to hear about new episodes and reminders."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {perm === "default" && (
          <button onClick={async () => setPerm(await enablePush())} className="h-10 rounded bg-brand px-4 font-semibold text-white hover:bg-brand-hover">Turn on notifications</button>
        )}
        {perm === "granted" && (
          <button onClick={() => showSystemNotification("MyFlix test notification", "Notifications are working on this device.", "/browse")} className="h-10 rounded border border-neutral-900 px-4 font-semibold">Send a test</button>
        )}
      </div>
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
                <span className="block font-semibold">{p.name} {p.hasPin && <span className="ml-1 text-xs text-neutral-500">PIN on</span>}</span>
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
  const [pinOn, setPinOn] = useState(Boolean(profile?.hasPin));
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  if (!profile || !s) return <PageTitle title="Profile not found" back="/account/profiles" />;
  const patch = (p: Partial<ProfileSettings>) => setS({ ...s, ...p });

  const save = async () => {
    if (pinOn && !profile.hasPin && !/^\d{4}$/.test(pin)) return setErr("Your PIN must be 4 digits.");
    if (pinOn && pin && !/^\d{4}$/.test(pin)) return setErr("Your PIN must be 4 digits.");
    setErr("");
    setLoading(true);
    const settings: Partial<ProfileSettings> = { ...s };
    delete settings.pin;
    if (pinOn && pin) settings.pin = pin; // new or changed PIN
    else if (!pinOn && profile.hasPin) settings.pin = undefined; // remove PIN
    const r = await updateProfile({ ...profile, settings });
    setLoading(false);
    if (!r.ok) return setErr(r.error);
    setPin("");
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
        <p className="mt-2 text-sm text-neutral-500">Display language for menus, rows and the player on the website, app and TV, and the default audio and subtitle language where available. Yorùbá, Hausa, Igbo and Pidgin are available.</p>
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

      <Card title="Screen time & data limits">
        <p className="mb-3 text-sm text-neutral-500">MyFlix extra: keep viewing healthy and protect your data bundle.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Daily viewing limit</span>
            <select value={s.dailyLimitMinutes ?? 0} onChange={(e) => patch({ dailyLimitMinutes: Number(e.target.value) || undefined })} className="h-11 w-full rounded border border-neutral-400 bg-white px-3">
              <option value={0}>No limit</option>
              {[30, 60, 90, 120, 180, 240].map((m) => <option key={m} value={m}>{m >= 60 ? `${m / 60} hour${m > 60 ? "s" : ""}` : `${m} minutes`} a day</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Monthly data cap</span>
            <select value={s.monthlyDataCapGB ?? 0} onChange={(e) => patch({ monthlyDataCapGB: Number(e.target.value) || undefined })} className="h-11 w-full rounded border border-neutral-400 bg-white px-3">
              <option value={0}>No cap</option>
              {[2, 5, 10, 20, 50].map((g) => <option key={g} value={g}>{g} GB, then switch to Data Saver</option>)}
            </select>
          </label>
        </div>
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
