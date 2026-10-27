"use client";

import { Send } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Avatar, Badge, Button, Card, Empty, PageHeader, Select, Tabs, Textarea, statusTone, useToast } from "@/components/ui";
import { ago, dateTime } from "@/lib/format";
import { currentStaff, upsert, useDb } from "@/lib/store";
import type { Ticket } from "@/lib/types";

const MACROS = [
  ["Duplicate charge", "Sorry about the double charge. We've refunded the extra payment; it reflects in 3-5 working days depending on your bank."],
  ["Buffering tips", "Please try: 1) restart your router, 2) set Data usage to Automatic in Profile Settings, 3) update the MyFlix app. If it continues, tell us your network provider."],
  ["USSD pending", "USSD payments can take up to 15 minutes to confirm. If it still shows failed after that, reply with your bank and the time you dialled the code."],
  ["Sign out device", "Go to Account > Devices and tap Sign out next to the device, or use Sign out of all devices under Security."],
] as const;

export default function SupportPage() {
  const tickets = useDb((d) => d.tickets);
  const staff = useDb((d) => d.staff);
  const me = useDb((d) => currentStaff(d));
  const toast = useToast();
  const [tab, setTab] = useState<"open" | "pending" | "resolved" | "all">("open");
  const [sel, setSel] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const list = tickets.filter((t) => tab === "all" || t.status === tab).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const t = tickets.find((x) => x.id === sel) ?? list[0];

  const update = (p: Partial<Ticket>, action?: string) => t && upsert("tickets", { ...t, ...p, updatedAt: new Date().toISOString() }, action, t.id);

  const send = (resolve = false) => {
    if (!t || !reply.trim()) return;
    update({ messages: [...t.messages, { from: "staff", author: me?.name ?? "Support", body: reply.trim(), at: new Date().toISOString() }], status: resolve ? "resolved" : "pending", assignee: t.assignee ?? me?.name }, resolve ? "Replied and resolved ticket" : "Replied to ticket");
    setReply("");
    toast(resolve ? "Reply sent and ticket resolved." : `Reply emailed to ${t.email}.`);
  };

  return (
    <div>
      <PageHeader title="Support" sub="Member tickets from the Help Centre, email and in-app chat." />
      <Tabs
        tabs={[
          { id: "open", label: "Open", count: tickets.filter((x) => x.status === "open").length },
          { id: "pending", label: "Awaiting member", count: tickets.filter((x) => x.status === "pending").length },
          { id: "resolved", label: "Resolved", count: tickets.filter((x) => x.status === "resolved").length },
          { id: "all", label: "All", count: tickets.length },
        ]}
        value={tab}
        onChange={(v) => { setTab(v); setSel(null); }}
      />
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card pad={false} className="max-h-[70vh] overflow-hidden">
          <ul className="thin-scroll max-h-[70vh] divide-y divide-slate-200/60 overflow-y-auto dark:divide-white/5">
            {list.length === 0 && <li><Empty title="No tickets here" /></li>}
            {list.map((x) => (
              <li key={x.id}>
                <button onClick={() => setSel(x.id)} className={`w-full p-4 text-left transition hover:bg-white/50 dark:hover:bg-white/5 ${t?.id === x.id ? "bg-white/70 dark:bg-white/10" : ""}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500">{x.id}</span>
                    <Badge tone={statusTone(x.priority)}>{x.priority}</Badge>
                    <span className="ml-auto text-xs text-slate-400">{ago(x.updatedAt)}</span>
                  </div>
                  <p className="mt-1 truncate font-semibold">{x.subject}</p>
                  <p className="truncate text-xs text-slate-500">{x.memberName} · {x.category}</p>
                </button>
              </li>
            ))}
          </ul>
        </Card>
        {t ? (
          <Card className="flex max-h-[70vh] flex-col">
            <div className="flex flex-wrap items-start gap-3 border-b border-slate-200/70 pb-4 dark:border-white/10">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-500">{t.id} · {t.category} · opened {dateTime(t.createdAt)}</p>
                <h2 className="text-lg font-bold">{t.subject}</h2>
                <p className="text-sm text-slate-500">
                  <Link href={`/users?id=${encodeURIComponent(t.memberId)}`} className="font-semibold text-brand">{t.memberName}</Link> · {t.email}
                </p>
              </div>
              <Select value={t.status} onChange={(e) => update({ status: e.target.value as Ticket["status"] }, `Set ticket ${e.target.value}`)} className="!w-36" aria-label="Status">
                <option value="open">Open</option>
                <option value="pending">Pending</option>
                <option value="resolved">Resolved</option>
              </Select>
              <Select value={t.priority} onChange={(e) => update({ priority: e.target.value as Ticket["priority"] }, "Changed ticket priority")} className="!w-32" aria-label="Priority">
                {["low", "normal", "high", "urgent"].map((p) => <option key={p}>{p}</option>)}
              </Select>
              <Select value={t.assignee ?? ""} onChange={(e) => update({ assignee: e.target.value || undefined }, "Assigned ticket")} className="!w-44" aria-label="Assignee">
                <option value="">Unassigned</option>
                {staff.map((s) => <option key={s.id}>{s.name}</option>)}
              </Select>
            </div>
            <div className="thin-scroll flex-1 space-y-4 overflow-y-auto py-4">
              {t.messages.map((m, i) => (
                <div key={i} className={`flex gap-3 ${m.from === "staff" ? "flex-row-reverse" : ""}`}>
                  <Avatar name={m.author} index={m.from === "staff" ? 0 : 3} />
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${m.from === "staff" ? "bg-brand text-white" : "bg-slate-900/5 dark:bg-white/10"}`}>
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    <p className={`mt-1 text-[10px] ${m.from === "staff" ? "text-white/70" : "text-slate-500"}`}>{m.author} · {dateTime(m.at)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-200/70 pt-3 dark:border-white/10">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {MACROS.map(([label, text]) => (
                  <button key={label} onClick={() => setReply(text)} className="rounded-full bg-slate-900/5 px-2.5 py-1 text-xs font-semibold hover:bg-slate-900/10 dark:bg-white/5">{label}</button>
                ))}
              </div>
              <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a reply…" className="!min-h-20" />
              <div className="mt-2 flex justify-end gap-2">
                <Button variant="outline" onClick={() => send(true)} disabled={!reply.trim()}>Reply & resolve</Button>
                <Button icon={<Send size={14} />} onClick={() => send()} disabled={!reply.trim()}>Send reply</Button>
              </div>
            </div>
          </Card>
        ) : (
          <Card><Empty title="Select a ticket" /></Card>
        )}
      </div>
    </div>
  );
}
