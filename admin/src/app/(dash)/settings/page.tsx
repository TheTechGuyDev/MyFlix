"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardTitle, Confirm, Field, Input, PageHeader, Select, Textarea, Toggle, useToast } from "@/components/ui";
import { storageEstimate } from "@/lib/media";
import { resetDemoData, setSettings, useDb } from "@/lib/store";
import type { Settings } from "@/lib/types";

export default function SettingsPage() {
  const saved = useDb((d) => d.settings);
  const [s, setS] = useState<Settings | null>(null);
  const [reset, setReset] = useState(false);
  const [store, setStore] = useState({ used: 0, quota: 0 });
  const toast = useToast();
  useEffect(() => {
    storageEstimate().then(setStore);
  }, []);
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
          <Toggle label="Nigeria only" sub="Block streaming outside Nigeria (licence regions)" on={cur.geoRestrictNigeria} onChange={(v) => set({ geoRestrictNigeria: v })} />
          <div className="grid gap-3 pt-2 sm:grid-cols-2">
            <Field label="Free trial (days)"><Input type="number" min={0} max={30} value={cur.freeTrialDays} onChange={(e) => set({ freeTrialDays: Number(e.target.value) })} /></Field>
            <Field label="Max profiles per account"><Input type="number" min={1} max={8} value={cur.maxProfiles} onChange={(e) => set({ maxProfiles: Number(e.target.value) })} /></Field>
          </div>
        </Card>
        <Card className="space-y-1">
          <CardTitle title="Payments" sub="Gateway keys are stored on the server once the backend is connected" />
          <Field label="Paystack public key"><Input value={cur.paystackPublicKey} onChange={(e) => set({ paystackPublicKey: e.target.value })} /></Field>
          <p className="py-1 text-xs text-slate-500">Secret key: {cur.paystackSecretSet ? "set on server" : "not set yet (added with the backend)"}</p>
          <Toggle label="Card payments" on onChange={() => toast("Cards are always on.", "bad")} />
          <Toggle label="Bank transfer" on={cur.transferEnabled} onChange={(v) => set({ transferEnabled: v })} />
          <Toggle label="USSD" on={cur.ussdEnabled} onChange={(v) => set({ ussdEnabled: v })} />
          <Toggle label="Flutterwave (backup gateway)" on={cur.flutterwaveEnabled} onChange={(v) => set({ flutterwaveEnabled: v })} />
        </Card>
        <Card className="space-y-1">
          <CardTitle title="Playback & downloads" />
          <Toggle label="Downloads" sub="Allow offline downloads in the mobile apps" on={cur.downloadsEnabled} onChange={(v) => set({ downloadsEnabled: v })} />
          <div className="grid gap-3 py-1 sm:grid-cols-2">
            <Field label="Max downloads per device"><Input type="number" value={cur.maxDownloadsPerDevice} onChange={(e) => set({ maxDownloadsPerDevice: Number(e.target.value) })} /></Field>
            <Field label="Downloads expire after (days)"><Input type="number" value={cur.downloadExpiryDays} onChange={(e) => set({ downloadExpiryDays: Number(e.target.value) })} /></Field>
          </div>
          <Toggle label="Data Saver on by default" sub="New profiles start on Save Data" on={cur.dataSaverDefault} onChange={(v) => set({ dataSaverDefault: v })} />
          <Toggle label="DRM protection" sub="Widevine / FairPlay licences (backend)" on={cur.drmEnabled} onChange={(v) => set({ drmEnabled: v })} />
          <Toggle label="Forensic watermark" sub="Invisible member ID in the stream to trace leaks" on={cur.watermarkEnabled} onChange={(v) => set({ watermarkEnabled: v })} />
        </Card>
        <Card className="xl:col-span-2">
          <CardTitle title="Data" sub={store.quota ? `This browser is using ${(store.used / 1024 ** 2).toFixed(1)} MB of ${(store.quota / 1024 ** 3).toFixed(1)} GB for uploads and data` : undefined} />
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
            Until the backend is connected, admin data is stored in this browser and shared with the MyFlix site on the same address. Reset restores the demo catalogue, members and payments (uploaded videos stay until removed from their titles).
          </p>
          <Button variant="danger" onClick={() => setReset(true)}>Reset demo data</Button>
        </Card>
      </div>
      <Confirm open={reset} danger label="Reset" title="Reset demo data?" body="All titles, plans, members, payments, campaigns and settings return to the original demo data. Live site accounts are kept." onCancel={() => setReset(false)} onConfirm={() => { resetDemoData(); setReset(false); toast("Demo data restored."); }} />
    </div>
  );
}
