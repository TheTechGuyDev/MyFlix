"use client";

import { Bell, Mail, MessageSquare, Plus, Send, Smartphone } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, Stat, Table, Tabs, Td, Textarea, statusTone, useToast } from "@/components/ui";
import { readLocal, useLocal, writeLocal, type OutMsg } from "@/lib/local";
import { dateTime, img, num } from "@/lib/format";
import { allMembers, remove, uid, upsert, useDb } from "@/lib/store";
import type { Campaign } from "@/lib/types";

const AUDIENCES = ["All active members", "Cancelled in last 90 days", "Past due members", "Trial members", "Premium members", "Mobile plan members", "Kids profiles", "Romance fans", "Thriller fans", "Lagos members", "Abuja (FCT) members"];

function reachFor(audience: string, members: ReturnType<typeof allMembers>) {
  const active = members.filter((m) => m.status === "active");
  switch (audience) {
    case "Cancelled in last 90 days": return members.filter((m) => m.status === "cancelled").length;
    case "Past due members": return members.filter((m) => m.status === "past_due").length;
    case "Trial members": return members.filter((m) => m.status === "trial").length;
    case "Premium members": return active.filter((m) => m.planId === "premium").length;
    case "Mobile plan members": return active.filter((m) => m.planId === "mobile").length;
    case "Kids profiles": return active.filter((m) => m.profiles.some((p) => p.kids)).length;
    case "Lagos members": return active.filter((m) => m.state === "Lagos").length;
    case "Abuja (FCT) members": return active.filter((m) => m.state === "Abuja (FCT)").length;
    case "Romance fans":
    case "Thriller fans": return Math.round(active.length * 0.38);
    default: return active.length;
  }
}

const icon = (c: Campaign["channel"]) => (c === "push" ? <Smartphone size={14} /> : c === "email" ? <Mail size={14} /> : c === "sms" ? <MessageSquare size={14} /> : <Bell size={14} />);

export default function CampaignsPage() {
  const campaigns = useDb((d) => d.campaigns);
  const titles = useDb((d) => d.titles.filter((t) => t.status !== "archived"));
  const members = useDb((d) => allMembers(d));
  const toast = useToast();
  const [edit, setEdit] = useState<Campaign | null>(null);
  const [tab, setTab] = useState<"campaigns" | "log">("campaigns");
  const [chan, setChan] = useState<"all" | OutMsg["channel"]>("all");
  const outbox = useLocal<OutMsg[]>("myflix.outbox", [], 4000);
  const sent = campaigns.filter((c) => c.status === "sent");
  const reach = sent.reduce((a, c) => a + c.reach, 0);
  const opens = sent.reduce((a, c) => a + c.opens, 0);
  const clicks = sent.reduce((a, c) => a + c.clicks, 0);

  const save = (status: Campaign["status"]) => {
    if (!edit) return;
    if (!edit.name.trim() || !edit.subject.trim() || !edit.body.trim()) return toast("Name, headline and message are required.", "bad");
    if (status === "scheduled" && !edit.scheduledAt) return toast("Pick a send time to schedule.", "bad");
    const r = reachFor(edit.audience, members);
    const c: Campaign = {
      ...edit,
      id: edit.id || uid("c"),
      status,
      ...(status === "sent" ? { sentAt: new Date().toISOString(), reach: r, opens: Math.round(r * (edit.channel === "push" ? 0.46 : edit.channel === "sms" ? 0.9 : 0.38)), clicks: Math.round(r * (edit.channel === "email" ? 0.11 : 0.19)) } : {}),
    };
    if (status === "sent" && c.channel !== "in_app") {
      const msg: OutMsg = { id: uid("m"), channel: c.channel === "push" ? "push" : c.channel, kind: "campaign", to: `${num(r)} members · ${c.audience}`, subject: c.subject, body: c.body, at: new Date().toISOString() };
      writeLocal("myflix.outbox", [msg, ...readLocal<OutMsg[]>("myflix.outbox", [])].slice(0, 300));
    }
    upsert("campaigns", c, status === "sent" ? `Sent ${c.channel} campaign` : status === "scheduled" ? "Scheduled campaign" : "Saved campaign draft", c.name);
    toast(status === "sent" ? `Sent to ${num(r)} members.` : "Campaign saved.");
    setEdit(null);
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Campaigns" sub="Push notifications, emails, SMS and in-app banners to bring members back." actions={<Button icon={<Plus size={15} />} onClick={() => setEdit({ id: "", name: "", channel: "push", audience: AUDIENCES[0], subject: "", body: "", status: "draft", reach: 0, opens: 0, clicks: 0, createdAt: new Date().toISOString() })}>New campaign</Button>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Campaigns sent" value={String(sent.length)} />
        <Stat label="Total reach" value={num(reach)} />
        <Stat label="Open rate" value={`${reach ? ((opens / reach) * 100).toFixed(1) : 0}%`} />
        <Stat label="Click rate" value={`${reach ? ((clicks / reach) * 100).toFixed(1) : 0}%`} />
      </div>
      <Tabs tabs={[{ id: "campaigns", label: "Campaigns", count: campaigns.length }, { id: "log", label: "Delivery log", count: outbox.length }]} value={tab} onChange={setTab} />
      {tab === "log" ? (
        <Card pad={false}>
          <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3">
            <p className="text-sm text-slate-500">Every email, SMS and push the platform sends: sign-in codes, password resets, receipts, security alerts, reminders and campaigns. With the backend these go through the email/SMS provider.</p>
            <Select value={chan} onChange={(e) => setChan(e.target.value as typeof chan)} aria-label="Channel" className="!w-40">
              <option value="all">All channels</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="push">Push</option>
            </Select>
          </div>
          {outbox.filter((m) => chan === "all" || m.channel === chan).length === 0 ? (
            <Empty title="Nothing sent yet" sub="Sign up, reset a password or request a sign-in code on the MyFlix site and the message appears here." />
          ) : (
            <Table head={["When", "Channel", "Type", "To", "Message"]} minW={860}>
              {outbox.filter((m) => chan === "all" || m.channel === chan).map((m) => (
                <tr key={m.id} className="align-top hover:bg-white/40 dark:hover:bg-white/5">
                  <Td className="whitespace-nowrap text-xs">{dateTime(m.at)}</Td>
                  <Td><Badge tone="info">{icon(m.channel === "push" ? "push" : m.channel)} {m.channel}</Badge></Td>
                  <Td className="capitalize">{m.kind}</Td>
                  <Td className="text-xs">{m.to}</Td>
                  <Td><span className="block font-semibold">{m.subject}</span><span className="text-xs text-slate-500">{m.kind === "code" ? m.body.replace(/^\d{6}/, "••••••") : m.body}</span></Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      ) : (
      <Card pad={false}>
        <Table head={["Campaign", "Channel", "Audience", "Status", "Reach", "Opens", "Clicks", ""]} minW={900}>
          {campaigns.map((c) => (
            <tr key={c.id} className="hover:bg-white/40 dark:hover:bg-white/5">
              <Td><span className="block font-semibold">{c.name}</span><span className="text-xs text-slate-500">{c.subject}</span></Td>
              <Td><Badge tone="info">{icon(c.channel)} {c.channel.replace("_", "-")}</Badge></Td>
              <Td className="text-xs">{c.audience}</Td>
              <Td><Badge tone={statusTone(c.status)}>{c.status}</Badge><span className="mt-0.5 block text-xs text-slate-500">{dateTime(c.sentAt ?? c.scheduledAt)}</span></Td>
              <Td>{num(c.reach)}</Td>
              <Td>{c.reach ? `${((c.opens / c.reach) * 100).toFixed(0)}%` : "-"}</Td>
              <Td>{c.reach ? `${((c.clicks / c.reach) * 100).toFixed(0)}%` : "-"}</Td>
              <Td>
                {c.status !== "sent" && <Button size="sm" variant="soft" onClick={() => setEdit({ ...c })}>Edit</Button>}
                {c.status === "sent" && <Button size="sm" variant="ghost" onClick={() => setEdit({ ...c, id: "", name: `${c.name} (copy)`, status: "draft", reach: 0, opens: 0, clicks: 0 })}>Duplicate</Button>}
              </Td>
            </tr>
          ))}
        </Table>
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
            <Button variant="outline" onClick={() => save("draft")}>Save draft</Button>
            <Button variant="outline" onClick={() => save("scheduled")}>Schedule</Button>
            <Button icon={<Send size={14} />} onClick={() => save("sent")}>Send now</Button>
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
                    <option value="push">Push notification</option>
                    <option value="email">Email</option>
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
