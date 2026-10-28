"use client";

import { useState } from "react";
import { Button, Card, CardTitle, Confirm, Field, Input, PageHeader, Select, Textarea, Toggle, useToast } from "@/components/ui";
import { sampleTitles } from "@/lib/seed";
import { importSamples, removeSamples, setSettings, useDb } from "@/lib/store";
import type { Settings } from "@/lib/types";

export default function SettingsPage() {
  const saved = useDb((d) => d.settings);
  const [s, setS] = useState<Settings | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [working, setWorking] = useState(false);
  const samples = useDb((d) => d.titles.filter((t) => t.sample).length);
  const toast = useToast();
  const cur = s ?? saved;
  const set = (p: Partial<Settings>) => setS({ ...cur, ...p });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        sub="Platform-wide controls. Saved changes apply to the MyFlix site immediately."
        actions={
          <>
            {s && <Button variant="outline" onClick={() => setS(null)}>Discard</Button>}
            <Button disabled={!s} onClick={() => { setSettings(cur); setS(null); toast("Settings saved."); }}>Save settings</Button>
          </>
        }
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="space-y-3">
          <CardTitle title="General" />
          <Field label="Platform name"><Input value={cur.platformName} onChange={(e) => set({ platformName: e.target.value })} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Support email"><Input value={cur.supportEmail} onChange={(e) => set({ supportEmail: e.target.value })} /></Field>
            <Field label="Support phone"><Input value={cur.supportPhone} onChange={(e) => set({ supportPhone: e.target.value })} /></Field>
          </div>
          <Field label="Default language">
            <Select value={cur.defaultLanguage} onChange={(e) => set({ defaultLanguage: e.target.value })}>
              {["English", "Yorùbá", "Hausa", "Igbo", "Pidgin"].map((l) => <option key={l}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Site-wide announcement" hint="Shown as a banner on MyFlix. Leave empty to hide.">
            <Input value={cur.announcement} onChange={(e) => set({ announcement: e.target.value })} placeholder="e.g. New: Eko Nights Season 2 is streaming now" />
          </Field>
        </Card>
        <Card className="space-y-1">
          <CardTitle title="Access" />
          <Toggle label="Maintenance mode" sub="Members see the message below instead of the app" on={cur.maintenance} onChange={(v) => set({ maintenance: v })} />
          {cur.maintenance && <Textarea value={cur.maintenanceMessage} onChange={(e) => set({ maintenanceMessage: e.target.value })} />}
          <Toggle label="New sign-ups open" sub="Turn off to pause new memberships" on={cur.signupsOpen} onChange={(v) => set({ signupsOpen: v })} />
          <div className="grid gap-3 pt-2 sm:grid-cols-2">
            <Field label="Max profiles per account"><Input type="number" min={1} max={8} value={cur.maxProfiles} onChange={(e) => set({ maxProfiles: Number(e.target.value) })} /></Field>
            <Field label="Staff session timeout (minutes)" hint="Staff are signed out after this long without activity"><Input type="number" min={5} max={480} value={cur.staffSessionMinutes} onChange={(e) => set({ staffSessionMinutes: Math.max(5, Number(e.target.value)) })} /></Field>
          </div>
          <Field label="Support WhatsApp number" hint="Shown in the Help Centre. Leave empty to hide.">
            <Input value={cur.supportWhatsapp} onChange={(e) => set({ supportWhatsapp: e.target.value })} placeholder="+234…" />
          </Field>
        </Card>
        <Card className="space-y-1">
          <CardTitle title="Payments" sub="Paystack keys are kept on the server, never in the browser" />
          <Toggle label="Card payments" sub="Always on. Needed for automatic renewals." on onChange={() => toast("Cards are always on.", "bad")} />
          <Toggle label="Bank transfer" sub="Pay with a one-time account number at checkout" on={cur.transferEnabled} onChange={(v) => set({ transferEnabled: v })} />
          <Toggle label="USSD" sub="Pay by dialling a bank code" on={cur.ussdEnabled} onChange={(v) => set({ ussdEnabled: v })} />
          <CardTitle title="Messages" sub="Turned on automatically when the email and SMS keys are added to the server" />
          <p className="text-sm">Email codes and receipts: <strong>{cur.emailCodesEnabled ? "On" : "Off"}</strong></p>
          <p className="text-sm">SMS sign-in codes: <strong>{cur.smsEnabled ? "On" : "Off"}</strong></p>
        </Card>
        <Card className="space-y-1">
          <CardTitle title="Playback & downloads" />
          <Toggle label="Downloads" sub="Allow offline downloads in the mobile apps" on={cur.downloadsEnabled} onChange={(v) => set({ downloadsEnabled: v })} />
          <div className="grid gap-3 py-1 sm:grid-cols-2">
            <Field label="Max downloads per device"><Input type="number" value={cur.maxDownloadsPerDevice} onChange={(e) => set({ maxDownloadsPerDevice: Number(e.target.value) })} /></Field>
            <Field label="Downloads expire after (days)"><Input type="number" value={cur.downloadExpiryDays} onChange={(e) => set({ downloadExpiryDays: Number(e.target.value) })} /></Field>
          </div>
          <Toggle label="Data Saver on by default" sub="New profiles start on Save Data" on={cur.dataSaverDefault} onChange={(v) => set({ dataSaverDefault: v })} />
          <p className="py-2 text-sm text-slate-600 dark:text-slate-300">Protected streaming is always on: every video plays through a signed link that expires, tied to a member with an active plan, capped at their plan&apos;s quality.</p>
          <Toggle label="Forensic watermark" sub="Faint, moving member ID over the video to trace leaks" on={cur.watermarkEnabled} onChange={(v) => set({ watermarkEnabled: v })} />
          <Toggle label="Block screenshots & screen recording" sub="Android app shows a black screen in screenshots and recordings" on={cur.screenshotBlock} onChange={(v) => set({ screenshotBlock: v })} />
          <Toggle label="Enforce screen limits" sub="Stop extra streams beyond each plan's screens (Live Now shows who is watching)" on={cur.streamLimitEnforced} onChange={(v) => set({ streamLimitEnforced: v })} />
        </Card>
        <Card className="xl:col-span-2">
          <CardTitle title="Sample catalogue" sub={samples ? `${samples} sample titles are on the site` : "No sample titles on the site"} />
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
            Sample titles let you test browsing and playback before your own films are uploaded. They play a short demo clip and are marked as samples. Remove them before launch so members only see real titles.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={working || samples > 0} onClick={async () => { setWorking(true); await importSamples(sampleTitles()); setWorking(false); toast("Sample titles added."); }}>{working ? "Working…" : "Add sample titles"}</Button>
            <Button variant="danger" disabled={working || samples === 0} onClick={() => setConfirmRemove(true)}>Remove sample titles</Button>
          </div>
        </Card>
      </div>
      <Confirm open={confirmRemove} danger label="Remove" title="Remove sample titles?" body="All sample titles disappear from MyFlix, including from members' lists and Continue Watching. Your own titles are not affected." onCancel={() => setConfirmRemove(false)} onConfirm={async () => { setConfirmRemove(false); setWorking(true); await removeSamples(); setWorking(false); toast("Sample titles removed."); }} />
    </div>
  );
}
