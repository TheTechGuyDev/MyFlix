"use client";

import { Download, Gift, KeyRound, Mail, PauseCircle, PlayCircle, RotateCcw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Avatar, Badge, Button, Card, CardTitle, Drawer, Field, Input, PageHeader, Select, Stat, Table, Td, Textarea, statusTone, useToast } from "@/components/ui";
import { STATES } from "@/lib/seed";
import { date, download, naira, num, toCsv } from "@/lib/format";
import { allMembers, getDb, log, uid, updateWebAccount, upsert, useDb } from "@/lib/store";
import type { Member, SubStatus } from "@/lib/types";

export default function Page() {
  return (
    <Suspense>
      <Members />
    </Suspense>
  );
}

function Members() {
  const members = useDb((d) => allMembers(d));
  const plans = useDb((d) => d.plans);
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [plan, setPlan] = useState("all");
  const [state, setState] = useState("all");
  const [source, setSource] = useState("all");
  const [page, setPage] = useState(0);
  const openId = params.get("id");
  const open = members.find((m) => m.id === openId) ?? null;
  const PAGE = 25;

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return members.filter(
      (m) =>
        (status === "all" || m.status === status) &&
        (plan === "all" || m.planId === plan) &&
        (state === "all" || m.state === state) &&
        (source === "all" || m.source === source) &&
        (!s || m.name.toLowerCase().includes(s) || m.email.includes(s) || (m.phone ?? "").includes(s)),
    );
  }, [members, q, status, plan, state, source]);

  const count = (s: SubStatus) => members.filter((m) => m.status === s).length;
  const planName = (id: string) => plans.find((p) => p.id === id)?.name ?? id;

  return (
    <div>
      <PageHeader
        title="Members"
        sub={`${members.length} accounts · ${members.filter((m) => m.source === "web").length} signed up on the live site`}
        actions={<Button variant="outline" icon={<Download size={15} />} onClick={() => download("myflix-members.csv", toCsv(list.map((m) => ({ id: m.id, name: m.name, email: m.email, phone: m.phone, state: m.state, plan: planName(m.planId), status: m.status, joined: date(m.joinedAt), renews: date(m.renewsAt), method: m.method }))))}>Export CSV</Button>}
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Active" value={num(count("active"))} />
        <Stat label="Trial" value={num(count("trial"))} />
        <Stat label="Past due" value={num(count("past_due"))} />
        <Stat label="Cancelled" value={num(count("cancelled"))} />
        <Stat label="Suspended" value={num(count("suspended"))} />
      </div>
      <Card className="mb-4">
        <div className="grid gap-3 md:grid-cols-6">
          <Input placeholder="Search name, email or phone…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} className="md:col-span-2" />
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} aria-label="Status">
            <option value="all">All statuses</option>
            {["active", "trial", "past_due", "cancelled", "suspended"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </Select>
          <Select value={plan} onChange={(e) => { setPlan(e.target.value); setPage(0); }} aria-label="Plan">
            <option value="all">All plans</option>
            {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Select value={state} onChange={(e) => { setState(e.target.value); setPage(0); }} aria-label="State">
            <option value="all">All states</option>
            {STATES.map((s) => <option key={s}>{s}</option>)}
          </Select>
          <Select value={source} onChange={(e) => { setSource(e.target.value); setPage(0); }} aria-label="Source">
            <option value="all">All sources</option>
            <option value="web">Live site sign-ups</option>
            <option value="demo">Demo members</option>
          </Select>
        </div>
      </Card>
      <Card pad={false}>
        <Table head={["Member", "Plan", "Status", "State", "Joined", "Next bill", "Watch hrs"]} minW={860}>
          {list.slice(page * PAGE, page * PAGE + PAGE).map((m) => (
            <tr key={m.id} onClick={() => router.push(`/users?id=${encodeURIComponent(m.id)}`)} className="cursor-pointer hover:bg-white/40 dark:hover:bg-white/5">
              <Td>
                <span className="flex items-center gap-3">
                  <Avatar name={m.name} index={m.name.length} />
                  <span>
                    <span className="block font-semibold">{m.name} {m.source === "web" && <Badge tone="brand">Live</Badge>}</span>
                    <span className="text-xs text-slate-500">{m.email}</span>
                  </span>
                </span>
              </Td>
              <Td>{planName(m.planId)}</Td>
              <Td><Badge tone={statusTone(m.status)}>{m.status.replace("_", " ")}</Badge></Td>
              <Td className="text-xs">{m.state}</Td>
              <Td className="text-xs text-slate-500">{date(m.joinedAt)}</Td>
              <Td className="text-xs text-slate-500">{m.status === "cancelled" ? "-" : date(m.renewsAt)}</Td>
              <Td>{m.watchHours}</Td>
            </tr>
          ))}
        </Table>
        <div className="flex items-center justify-between border-t border-slate-200/70 px-4 py-3 text-sm dark:border-white/10">
          <span className="text-slate-500">{list.length ? `${page * PAGE + 1}-${Math.min(list.length, page * PAGE + PAGE)} of ${list.length}` : "No members"}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={(page + 1) * PAGE >= list.length} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      </Card>
      {open && <MemberDrawer m={open} onClose={() => router.push("/users")} />}
    </div>
  );
}

function MemberDrawer({ m, onClose }: { m: Member; onClose: () => void }) {
  const plans = useDb((d) => d.plans);
  const txns = useDb((d) => d.txns.filter((t) => t.memberId === m.id || t.email === m.email));
  const tickets = useDb((d) => d.tickets.filter((t) => t.email === m.email));
  const toast = useToast();
  const [notes, setNotes] = useState(m.notes ?? "");
  const [planId, setPlanId] = useState(m.planId);

  const save = (patch: Partial<Member>, action: string, web?: Record<string, unknown>) => {
    if (m.source === "web") {
      if (web) updateWebAccount(m.email, web);
      log(action, m.email);
    } else upsert("members", { ...m, ...patch }, action, m.email);
    toast(`${action}.`);
  };

  const refundLast = () => {
    const last = txns.find((t) => t.status === "success");
    if (!last) return toast("No successful payment to refund.", "bad");
    upsert("txns", { ...last, status: "refunded" }, "Refunded payment", `${last.reference} (${naira(last.amount)})`);
    toast(`Refunded ${naira(last.amount)}.`);
  };

  const comp = () => {
    const next = new Date(m.renewsAt);
    next.setMonth(next.getMonth() + 1);
    save({ renewsAt: next.toISOString() }, "Gave 1 free month");
    upsert("txns", { id: uid("t"), memberId: m.id, memberName: m.name, email: m.email, amount: 0, planId: m.planId, method: m.method, status: "success", at: new Date().toISOString(), reference: "COMP-1MONTH" });
  };

  return (
    <Drawer open onClose={onClose} title="Member details">
      <div className="flex items-center gap-4">
        <Avatar name={m.name} size={56} index={m.name.length} />
        <div>
          <p className="text-lg font-bold">{m.name}</p>
          <p className="text-sm text-slate-500">{m.email}</p>
          <div className="mt-1 flex gap-1.5">
            <Badge tone={statusTone(m.status)}>{m.status.replace("_", " ")}</Badge>
            {m.source === "web" && <Badge tone="brand">Signed up on live site</Badge>}
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        {[
          ["Phone", m.phone ?? "-"],
          ["State", m.state],
          ["Joined", date(m.joinedAt)],
          ["Next bill", m.status === "cancelled" ? "Cancelled" : date(m.renewsAt)],
          ["Payment", m.method === "card" ? `Card •••• ${m.last4 ?? ""}` : m.method === "transfer" ? "Bank transfer" : "USSD"],
          ["Devices", String(m.devices)],
          ["Watch hours", String(m.watchHours)],
          ["Last active", date(m.lastActive)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-slate-900/5 p-3 dark:bg-white/5">
            <p className="text-xs text-slate-500">{k}</p>
            <p className="font-semibold">{v}</p>
          </div>
        ))}
      </div>

      <Card className="mt-5">
        <CardTitle title="Subscription" />
        <div className="flex gap-2">
          <Select value={planId} onChange={(e) => setPlanId(e.target.value)} aria-label="Plan">
            {plans.map((p) => <option key={p.id} value={p.id}>{p.name} · {naira(p.price)}</option>)}
          </Select>
          <Button disabled={planId === m.planId} onClick={() => save({ planId }, `Changed plan to ${plans.find((p) => p.id === planId)?.name}`, { planId })}>Change</Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {m.status === "suspended" ? (
            <Button size="sm" variant="soft" icon={<PlayCircle size={14} />} onClick={() => save({ status: "active" }, "Reactivated account", { suspended: undefined })}>Reactivate</Button>
          ) : (
            <Button size="sm" variant="outline" icon={<PauseCircle size={14} />} onClick={() => save({ status: "suspended" }, "Suspended account", { suspended: true })}>Suspend</Button>
          )}
          {m.status === "cancelled" ? (
            <Button size="sm" variant="outline" onClick={() => save({ status: "active" }, "Restarted membership", { cancelAt: undefined })}>Restart membership</Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => save({ status: "cancelled" }, "Cancelled membership", { cancelAt: new Date().toISOString() })}>Cancel membership</Button>
          )}
          <Button size="sm" variant="outline" icon={<Gift size={14} />} onClick={comp}>Give 1 free month</Button>
          <Button size="sm" variant="outline" icon={<RotateCcw size={14} />} onClick={refundLast}>Refund last payment</Button>
          <Button size="sm" variant="outline" icon={<KeyRound size={14} />} onClick={() => { log("Sent password reset", m.email); toast(`Password reset link sent to ${m.email}.`); }}>Send password reset</Button>
          <Button size="sm" variant="outline" icon={<Mail size={14} />} onClick={() => window.open(`mailto:${m.email}`)}>Email</Button>
        </div>
      </Card>

      <Card className="mt-4">
        <CardTitle title="Profiles" />
        <div className="flex flex-wrap gap-2">
          {m.profiles.map((p, i) => (
            <span key={i} className="flex items-center gap-2 rounded-xl bg-slate-900/5 px-3 py-2 text-sm dark:bg-white/5">
              <Avatar name={p.name} size={22} index={i} /> {p.name} {p.kids && <Badge tone="info">Kids</Badge>}
            </span>
          ))}
        </div>
      </Card>

      <Card className="mt-4">
        <CardTitle title="Payments" sub={`${txns.length} transactions`} />
        <ul className="divide-y divide-slate-200/60 text-sm dark:divide-white/5">
          {txns.slice(0, 8).map((t) => (
            <li key={t.id} className="flex items-center justify-between py-2">
              <span>
                {date(t.at)} <span className="text-xs text-slate-500">· {t.reference}</span>
              </span>
              <span className="flex items-center gap-2">
                <b>{naira(t.amount)}</b> <Badge tone={statusTone(t.status)}>{t.status}</Badge>
              </span>
            </li>
          ))}
          {txns.length === 0 && <li className="py-2 text-slate-500">No payments recorded.</li>}
        </ul>
      </Card>

      {tickets.length > 0 && (
        <Card className="mt-4">
          <CardTitle title="Support tickets" />
          {tickets.map((t) => <p key={t.id} className="text-sm">{t.id} · {t.subject} <Badge tone={statusTone(t.status)}>{t.status}</Badge></p>)}
        </Card>
      )}

      <Card className="mt-4">
        <Field label="Internal notes" hint="Only staff can see this">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Button size="sm" className="mt-2" onClick={() => {
          if (m.source === "web") { log("Added note", m.email); toast("Note saved."); return; }
          upsert("members", { ...getDb().members.find((x) => x.id === m.id)!, notes }, "Updated notes", m.email);
          toast("Note saved.");
        }}>Save note</Button>
      </Card>
    </Drawer>
  );
}
