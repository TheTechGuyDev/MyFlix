"use client";

import { Download, Gift, KeyRound, LogOut, Mail, PauseCircle, PlayCircle, RotateCcw, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Avatar, Badge, Button, Card, CardTitle, Confirm, Drawer, Field, Input, PageHeader, Select, Stat, Table, Td, Textarea, statusTone, useToast } from "@/components/ui";
import { STATES } from "@/lib/seed";
import { date, download, naira, num, toCsv } from "@/lib/format";
import { adminAction, allMembers, getDb, log, upsert, useDb } from "@/lib/store";
import { sb } from "@/lib/supabase";
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
        (!s || m.name.toLowerCase().includes(s) || m.email.includes(s) || (m.phone ?? "").includes(s)),
    );
  }, [members, q, status, plan, state]);

  const count = (s: SubStatus) => members.filter((m) => m.status === s).length;
  const planName = (id: string) => plans.find((p) => p.id === id)?.name ?? id;

  return (
    <div>
      <PageHeader
        title="Members"
        sub={`${members.length} accounts`}
        actions={<Button variant="outline" icon={<Download size={15} />} onClick={() => download("myflix-members.csv", toCsv(list.map((m) => ({ id: m.id, name: m.name, email: m.email, phone: m.phone, state: m.state, plan: planName(m.planId), status: m.status, joined: date(m.joinedAt), renews: date(m.renewsAt), method: m.method }))))}>Export CSV</Button>}
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Active" value={num(count("active"))} />
        <Stat label="Awaiting payment" value={num(count("pending"))} />
        <Stat label="Past due" value={num(count("past_due"))} />
        <Stat label="Cancelled" value={num(count("cancelled"))} />
        <Stat label="Suspended" value={num(count("suspended"))} />
      </div>
      <Card className="mb-4">
        <div className="grid gap-3 md:grid-cols-5">
          <Input placeholder="Search name, email or phone…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} className="md:col-span-2" />
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} aria-label="Status">
            <option value="all">All statuses</option>
            {["active", "pending", "past_due", "cancelled", "suspended"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </Select>
          <Select value={plan} onChange={(e) => { setPlan(e.target.value); setPage(0); }} aria-label="Plan">
            <option value="all">All plans</option>
            {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Select value={state} onChange={(e) => { setState(e.target.value); setPage(0); }} aria-label="State">
            <option value="all">All states</option>
            {STATES.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </div>
      </Card>
      <Card pad={false}>
        <Table head={["Member", "Plan", "Status", "State", "Joined", "Paid until", "Profiles"]} minW={860}>
          {list.slice(page * PAGE, page * PAGE + PAGE).map((m) => (
            <tr key={m.id} onClick={() => router.push(`/users?id=${encodeURIComponent(m.id)}`)} className="cursor-pointer hover:bg-white/40 dark:hover:bg-white/5">
              <Td>
                <span className="flex items-center gap-3">
                  <Avatar name={m.name} index={m.name.length} />
                  <span>
                    <span className="block font-semibold">{m.name}</span>
                    <span className="text-xs text-slate-500">{m.email}</span>
                  </span>
                </span>
              </Td>
              <Td>{m.planId ? planName(m.planId) : "-"}</Td>
              <Td><Badge tone={statusTone(m.status)}>{m.status.replace("_", " ")}</Badge></Td>
              <Td className="text-xs">{m.state}</Td>
              <Td className="text-xs text-slate-500">{date(m.joinedAt)}</Td>
              <Td className="text-xs text-slate-500">{m.paidUntil ? date(m.paidUntil) : "-"}</Td>
              <Td>{m.profiles.length}</Td>
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

  const [busy, setBusy] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const paidFuture = Boolean(m.paidUntil && new Date(m.paidUntil) > new Date());
  const save = (patch: Partial<Member>, action: string) => {
    upsert("members", { ...m, ...patch }, action, m.email);
    toast(`${action}.`);
  };
  const run = async (label: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(label);
    try {
      await fn();
      toast(done);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Something went wrong.", "bad");
    } finally {
      setBusy("");
    }
  };

  const comp = () => {
    const from = paidFuture ? new Date(m.paidUntil!) : new Date();
    from.setMonth(from.getMonth() + 1);
    save({ paidUntil: from.toISOString(), renewsAt: from.toISOString(), status: m.status === "suspended" ? "suspended" : "active", planId: m.planId || "basic" }, "Gave 1 free month");
  };
  const refundLast = () => {
    const last = txns.find((t) => t.status === "success" && t.amount > 0);
    if (!last) return toast("No paid payment to refund.", "bad");
    if (!confirm(`Refund ${naira(last.amount)} (${last.reference}) to the member's card or account? This can't be undone.`)) return;
    void run("refund", () => adminAction("refund", { payment_id: last.id }), `Refund of ${naira(last.amount)} started. Paystack returns it in 5 to 10 working days.`);
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
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        {[
          ["Phone", m.phone ?? "-"],
          ["State", m.state],
          ["Joined", date(m.joinedAt)],
          ["Paid until", m.paidUntil ? date(m.paidUntil) : "Not paid yet"],
          ["Membership ends", m.cancelAt ? date(m.cancelAt) : "Renews automatically"],
          ["Last payment", m.last4 ? `Card •••• ${m.last4}` : m.method === "transfer" ? "Bank transfer" : m.method === "ussd" ? "USSD" : m.method === "credit" ? "Credit" : "-"],
          ["Credit", naira(m.credit ?? 0)],
          ["Devices", String(m.devices)],
          ["Referral code", m.referralCode ?? "-"],
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
          <Button disabled={planId === m.planId} onClick={() => save({ planId }, `Changed plan to ${plans.find((p) => p.id === planId)?.name}`)}>Change</Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {m.status === "suspended" ? (
            <Button size="sm" variant="soft" icon={<PlayCircle size={14} />} onClick={() => save({ status: paidFuture ? (m.cancelAt ? "cancelled" : "active") : "pending" }, "Reactivated account")}>Reactivate</Button>
          ) : (
            <Button size="sm" variant="outline" icon={<PauseCircle size={14} />} onClick={() => { save({ status: "suspended" }, "Suspended account"); void adminAction("signout_member", { account_id: m.id }).catch(() => undefined); }}>Suspend</Button>
          )}
          {m.cancelAt ? (
            <Button size="sm" variant="outline" onClick={() => save({ cancelAt: undefined, status: m.status === "cancelled" && paidFuture ? "active" : m.status }, "Restarted membership")}>Restart membership</Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => save({ cancelAt: m.paidUntil ?? new Date().toISOString(), status: m.status === "active" ? "cancelled" : m.status }, "Cancelled membership")}>Cancel at period end</Button>
          )}
          <Button size="sm" variant="outline" icon={<Gift size={14} />} onClick={comp}>Give 1 free month</Button>
          <Button size="sm" variant="outline" icon={<RotateCcw size={14} />} disabled={busy === "refund"} onClick={refundLast}>{busy === "refund" ? "Refunding…" : "Refund last payment"}</Button>
          <Button size="sm" variant="outline" icon={<KeyRound size={14} />} disabled={busy === "reset"} onClick={() => run("reset", async () => { const { error } = await sb().auth.resetPasswordForEmail(m.email); if (error) throw new Error(error.message); log("Sent password reset", m.email); }, `Password reset email sent to ${m.email}.`)}>Send password reset</Button>
          <Button size="sm" variant="outline" icon={<LogOut size={14} />} disabled={busy === "signout"} onClick={() => run("signout", () => adminAction("signout_member", { account_id: m.id }), "Signed out of all devices.")}>Sign out everywhere</Button>
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
          upsert("members", { ...getDb().members.find((x) => x.id === m.id)!, notes }, "Updated notes", m.email);
          toast("Note saved.");
        }}>Save note</Button>
      </Card>

      <Card className="mt-4">
        <CardTitle title="Delete account" sub="Permanently removes the member, their profiles, history and saved card. Payment records are kept for tax law." />
        <Button size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={() => setConfirmDelete(true)}>Delete member</Button>
      </Card>
      <Confirm
        open={confirmDelete}
        danger
        label="Delete"
        title={`Delete ${m.email}?`}
        body="This can't be undone. The member is signed out everywhere and can sign up again later as a new member."
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => { setConfirmDelete(false); void run("delete", async () => { await adminAction("delete_member", { account_id: m.id }); onClose(); }, "Member deleted."); }}
      />
    </Drawer>
  );
}
