"use client";

import { Bell, Mail, MessageSquare, Plus, Send, Smartphone } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, Stat, Table, Tabs, Td, Textarea, statusTone, useToast } from "@/components/ui";
import { dateTime, img, num } from "@/lib/format";
import { allMembers, log, remove, saveCampaign, useDb } from "@/lib/store";
import { sb } from "@/lib/supabase";
import type { Campaign } from "@/lib/types";

// Must match the audiences the campaigns function understands
const AUDIENCES = ["All active members", "Cancelled in last 90 days", "Past due members", "Signed up, never paid", "Premium members", "Mobile plan members", "Lagos members", "Abuja (FCT) members"];

function reachFor(audience: string, members: ReturnType<typeof allMembers>) {
  const now = Date.now();
  const access = (m: (typeof members)[number]) => ["active", "cancelled", "past_due"].includes(m.status) && Boolean(m.paidUntil && new Date(m.paidUntil).getTime() > now);
  const active = members.filter(access);
  switch (audience) {
    case "Cancelled in last 90 days": return members.filter((m) => m.status === "cancelled").length;
    case "Past due members": return members.filter((m) => m.status === "past_due").length;
    case "Signed up, never paid": return members.filter((m) => m.status === "pending").length;
    case "Premium members": return active.filter((m) => m.planId === "premium").length;
    case "Mobile plan members": return active.filter((m) => m.planId === "mobile").length;
    case "Lagos members": return active.filter((m) => m.state === "Lagos").length;
    case "Abuja (FCT) members": return active.filter((m) => m.state === "Abuja (FCT)").length;
    default: return active.length;
  }
}

type OutMsg = { id: number; channel: "email" | "sms" | "push"; kind: string; to_addr: string; subject: string | null; body: string | null; status: string; error: string | null; created_at: string };
const icon = (c: Campaign["channel"]) => (c === "push" ? <Smartphone size={14} /> : c === "email" ? <Mail size={14} /> : c === "sms" ? <MessageSquare size={14} /> : <Bell size={14} />);
const mask = (m: OutMsg, t: string | null) => (m.kind.startsWith("auth") ? (t ?? "").replace(/\b\d{6}\b/g, "••••••") : t ?? "");
const plain = (html: string) => html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 220);

export default function CampaignsPage() {
  const campaigns = useDb((d) => d.campaigns);
  const titles = useDb((d) => d.titles.filter((t) => t.status !== "archived"));
  const members = useDb((d) => allMembers(d));
  const toast = useToast();
  const [edit, setEdit] = useState<Campaign | null>(null);
  const [tab, setTab] = useState<"campaigns" | "log">("campaigns");
  const [chan, setChan] = useState<"all" | OutMsg["channel"]>("all");
  const [outbox, setOutbox] = useState<OutMsg[]>([]);
  const [busy, setBusy] = useState(false);
  const sent = campaigns.filter((c) => c.status === "sent");
  const reach = sent.reduce((a, c) => a + c.reach, 0);

  const loadLog = useCallback(async () => {
    let q = sb().from("outbox").select("*").order("created_at", { ascending: false }).limit(200);
    if (chan !== "all") q = q.eq("channel", chan);
    const { data } = await q;
    setOutbox((data as OutMsg[]) ?? []);
  }, [chan]);
  useEffect(() => {
    if (tab === "log") void loadLog();
  }, [tab, loadLog]);

  const save = async (status: "draft" | "scheduled" | "sent") => {
    if (!edit) return;
    if (!edit.name.trim() || !edit.subject.trim() || !edit.body.trim()) return toast("Name, headline and message are required.", "bad");
    if (status === "scheduled" && (!edit.scheduledAt || new Date(edit.scheduledAt).getTime() < Date.now())) return toast("Pick a send time in the future to schedule.", "bad");
    const r = reachFor(edit.audience, members);
    if (status === "sent" && !confirm(`Send "${edit.subject}" by ${edit.channel.replace("_", "-")} to about ${num(r)} members now? This can't be undone.`)) return;
    const c: Campaign = { ...edit, id: edit.id || crypto.randomUUID(), status: status === "sent" ? "draft" : status };
    setBusy(true);
    try {
      const n = await saveCampaign(c, status === "sent");
      if (n == null) return;
      log(status === "sent" ? `Sent ${c.channel} campaign` : status === "scheduled" ? "Scheduled campaign" : "Saved campaign draft", c.name);
      toast(status === "sent" ? `Sent to ${num(n)} members.` : status === "scheduled" ? `Scheduled for ${dateTime(c.scheduledAt)}.` : "Campaign saved.");
      setEdit(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't send the campaign.", "bad");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Campaigns" sub="Push notifications, emails, SMS and in-app banners to bring members back." actions={<Button icon={<Plus size={15} />} onClick={() => setEdit({ id: "", name: "", channel: "push", audience: AUDIENCES[0], subject: "", body: "", status: "draft", reach: 0, opens: 0, clicks: 0, createdAt: new Date().toISOString() })}>New campaign</Button>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Campaigns sent" value={String(sent.length)} />
        <Stat label="Total reach" value={num(reach)} />
        <Stat label="Scheduled" value={String(campaigns.filter((c) => c.status === "scheduled").length)} hint="Sent automatically on the hour" />
        <Stat label="Drafts" value={String(campaigns.filter((c) => c.status === "draft").length)} />
      </div>
      <Tabs tabs={[{ id: "campaigns", label: "Campaigns", count: campaigns.length }, { id: "log", label: "Delivery log" }]} value={tab} onChange={setTab} />
      {tab === "log" ? (
        <Card pad={false}>
          <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3">
            <p className="max-w-2xl text-sm text-slate-500">The last 200 emails and texts the platform sent: sign-in codes (hidden), password resets, receipts, reminders and campaigns. &quot;Skipped&quot; means the email or SMS keys aren&apos;t set yet.</p>
            <Select value={chan} onChange={(e) => setChan(e.target.value as typeof chan)} aria-label="Channel" className="!w-40">
              <option value="all">All channels</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="push">Push</option>
            </Select>
          </div>
          {outbox.length === 0 ? (
            <Empty title="Nothing sent yet" sub="Sign-up codes, password resets, receipts and campaigns appear here once they're sent." />
          ) : (
            <Table head={["When", "Channel", "Type", "To", "Message", "Status"]} minW={960}>
              {outbox.map((m) => (
                <tr key={m.id} className="align-top hover:bg-white/40 dark:hover:bg-white/5">
                  <Td className="whitespace-nowrap text-xs">{dateTime(m.created_at)}</Td>
                  <Td><Badge tone="info">{icon(m.channel)} {m.channel}</Badge></Td>
                  <Td className="text-xs">{m.kind.replace("auth:", "")}</Td>
                  <Td className="text-xs">{m.to_addr}</Td>
                  <Td><span className="block font-semibold">{mask(m, m.subject)}</span><span className="text-xs text-slate-500">{mask(m, plain(m.body ?? ""))}</span></Td>
                  <Td><Badge tone={m.status === "sent" ? "ok" : m.status === "failed" ? "bad" : "muted"}>{m.status}</Badge>{m.error && <span className="block max-w-[180px] text-xs text-danger">{m.error}</span>}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      ) : (
      <Card pad={false}>
        {campaigns.length === 0 && <Empty title="No campaigns yet" sub="Create one to tell members about new releases." />}
        {campaigns.length > 0 && <Table head={["Campaign", "Channel", "Audience", "Status", "Reach", ""]} minW={800}>
          {campaigns.map((c) => (
            <tr key={c.id} className="hover:bg-white/40 dark:hover:bg-white/5">
              <Td><span className="block font-semibold">{c.name}</span><span className="text-xs text-slate-500">{c.subject}</span></Td>
              <Td><Badge tone="info">{icon(c.channel)} {c.channel.replace("_", "-")}</Badge></Td>
              <Td className="text-xs">{c.audience}</Td>
              <Td><Badge tone={statusTone(c.status)}>{c.status}</Badge><span className="mt-0.5 block text-xs text-slate-500">{dateTime(c.sentAt ?? c.scheduledAt)}</span></Td>
              <Td>{c.status === "sent" ? num(c.reach) : "-"}</Td>
              <Td>
                {c.status !== "sent" && c.status !== "sending" && <Button size="sm" variant="soft" onClick={() => setEdit({ ...c })}>Edit</Button>}
                {c.status === "sent" && <Button size="sm" variant="ghost" onClick={() => setEdit({ ...c, id: "", name: `${c.name} (copy)`, status: "draft", reach: 0, opens: 0, clicks: 0 })}>Duplicate</Button>}
              </Td>
            </tr>
          ))}
        </Table>}
      </Card>
      )}

      <Modal
        open={Boolean(edit)}
        onClose={() => setEdit(null)}
        wide
        title={edit?.id ? "Edit campaign" : "New campaign"}
        footer={
          <>
            {edit?.id && <Button variant="ghost" className="mr-auto text-danger" onClick={() => { remove("campaigns", edit.id, "Deleted campaign", edit.name); setEdit(null); }}>Delete</Button>}
            <Button variant="outline" disabled={busy} onClick={() => save("draft")}>Save draft</Button>
            <Button variant="outline" disabled={busy} onClick={() => save("scheduled")}>Schedule</Button>
            <Button icon={<Send size={14} />} disabled={busy} onClick={() => save("sent")}>{busy ? "Sending…" : "Send now"}</Button>
          </>
        }
      >
        {edit && (
          <div className="grid gap-5 md:grid-cols-[1fr_260px]">
            <div className="space-y-3">
              <Field label="Internal name"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="e.g. Friday premiere push" /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Channel">
                  <Select value={edit.channel} onChange={(e) => setEdit({ ...edit, channel: e.target.value as Campaign["channel"] })}>
                    <option value="push">App notification</option>
                    <option value="email">Email (members who opted in to offers)</option>
                    <option value="sms">SMS</option>
                    <option value="in_app">In-app banner</option>
                  </Select>
                </Field>
                <Field label="Audience" hint={`About ${num(reachFor(edit.audience, members))} members`}>
                  <Select value={edit.audience} onChange={(e) => setEdit({ ...edit, audience: e.target.value })}>
                    {AUDIENCES.map((a) => <option key={a}>{a}</option>)}
                  </Select>
                </Field>
              </div>
              <Field label={edit.channel === "email" ? "Subject line" : "Headline"}><Input value={edit.subject} maxLength={80} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} /></Field>
              <Field label="Message" hint={edit.channel === "sms" ? `${edit.body.length}/160` : undefined}><Textarea value={edit.body} maxLength={edit.channel === "sms" ? 160 : 600} onChange={(e) => setEdit({ ...edit, body: e.target.value })} /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Link to title (optional)">
                  <Select value={edit.titleId ?? ""} onChange={(e) => setEdit({ ...edit, titleId: e.target.value || undefined })}>
                    <option value="">None</option>
                    {titles.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </Select>
                </Field>
                <Field label="Send at (for scheduling)"><Input type="datetime-local" value={edit.scheduledAt?.slice(0, 16) ?? ""} onChange={(e) => setEdit({ ...edit, scheduledAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })} /></Field>
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-500">Preview</p>
              <div className="rounded-[2rem] border-8 border-slate-900 bg-gradient-to-b from-slate-800 to-slate-950 p-3 text-white">
                <div className="rounded-2xl bg-white/15 p-3 backdrop-blur">
                  <div className="flex items-center gap-2 text-[11px] text-white/70"><span className="font-display text-sm text-brand-bright">M</span> MyFlix · now</div>
                  <p className="mt-1 text-sm font-semibold">{edit.subject || "Your headline"}</p>
                  <p className="text-xs text-white/80">{edit.body || "Your message"}</p>
                  {edit.titleId && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img(titles.find((t) => t.id === edit.titleId)?.image ?? "", 400, 225)} alt="" className="mt-2 aspect-video w-full rounded-lg object-cover" />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
