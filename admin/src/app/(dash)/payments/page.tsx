"use client";

import { Download, RefreshCw, RotateCcw } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, Button, Card, CardTitle, Input, PageHeader, Select, Stat, Table, Td, statusTone, useToast } from "@/components/ui";
import { chartTip, dateTime, download, naira, nairaShort, toCsv } from "@/lib/format";
import { monthKeys } from "@/lib/metrics";
import { upsert, useDb } from "@/lib/store";

export default function Page() {
  return (
    <Suspense>
      <Payments />
    </Suspense>
  );
}

function Payments() {
  const txns = useDb((d) => d.txns);
  const plans = useDb((d) => d.plans);
  const params = useSearchParams();
  const toast = useToast();
  const [status, setStatus] = useState(params.get("status") ?? "all");
  const [method, setMethod] = useState("all");
  const [q, setQ] = useState("");
  const [range, setRange] = useState("30");
  const [page, setPage] = useState(0);
  const PAGE = 30;

  const list = useMemo(() => {
    const from = range === "all" ? 0 : Date.now() - Number(range) * 864e5;
    const s = q.trim().toLowerCase();
    return txns.filter(
      (t) => (status === "all" || t.status === status) && (method === "all" || t.method === method) && new Date(t.at).getTime() >= from && (!s || t.memberName.toLowerCase().includes(s) || t.email.includes(s) || t.reference.toLowerCase().includes(s)),
    );
  }, [txns, status, method, q, range]);

  const ok = list.filter((t) => t.status === "success");
  const failed = list.filter((t) => t.status === "failed");
  const refunded = list.filter((t) => t.status === "refunded");
  const gross = ok.reduce((a, t) => a + t.amount, 0);
  const fees = ok.reduce((a, t) => a + Math.min(2000, t.amount * 0.015 + (t.amount >= 2500 ? 100 : 0)), 0);

  const byMonth = monthKeys(6).map((m) => {
    const inM = txns.filter((t) => t.status === "success" && new Date(t.at) >= m.start && new Date(t.at) < m.end);
    return { label: m.label, Card: inM.filter((t) => t.method === "card").reduce((a, t) => a + t.amount, 0), Transfer: inM.filter((t) => t.method === "transfer").reduce((a, t) => a + t.amount, 0), USSD: inM.filter((t) => t.method === "ussd").reduce((a, t) => a + t.amount, 0) };
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Payments"
        sub="All subscription charges processed through Paystack (card, bank transfer and USSD)."
        actions={<Button variant="outline" icon={<Download size={15} />} onClick={() => download("myflix-payments.csv", toCsv(list.map((t) => ({ reference: t.reference, date: dateTime(t.at), member: t.memberName, email: t.email, plan: plans.find((p) => p.id === t.planId)?.name, method: t.method, amount: t.amount, status: t.status }))))}>Export CSV</Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Gross revenue" value={nairaShort(gross)} hint={`${ok.length} successful charges`} />
        <Stat label="Net after fees" value={nairaShort(gross - fees)} hint={`Gateway fees ${nairaShort(fees)}`} />
        <Stat label="Success rate" value={`${list.length ? ((ok.length / list.length) * 100).toFixed(1) : "0"}%`} hint={`${failed.length} failed`} />
        <Stat label="Refunds" value={nairaShort(refunded.reduce((a, t) => a + t.amount, 0))} hint={`${refunded.length} refunds`} />
      </div>
      <Card>
        <CardTitle title="Revenue by payment method" sub="Last 6 months" />
        <div className="h-56">
          <ResponsiveContainer>
            <BarChart data={byMonth} margin={{ left: -5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.08} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickFormatter={(v) => nairaShort(v)} tickLine={false} axisLine={false} fontSize={11} width={55} />
              <Tooltip {...chartTip} formatter={(v) => naira(Number(v))} />
              <Bar dataKey="Card" stackId="a" fill="#0d9b5f" />
              <Bar dataKey="Transfer" stackId="a" fill="#3b82f6" />
              <Bar dataKey="USSD" stackId="a" fill="#f5a524" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card>
        <div className="grid gap-3 md:grid-cols-5">
          <Input placeholder="Search member, email or reference…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} className="md:col-span-2" />
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} aria-label="Status">
            <option value="all">All statuses</option>
            <option value="success">Successful</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
            <option value="pending">Pending</option>
          </Select>
          <Select value={method} onChange={(e) => { setMethod(e.target.value); setPage(0); }} aria-label="Method">
            <option value="all">All methods</option>
            <option value="card">Card</option>
            <option value="transfer">Bank transfer</option>
            <option value="ussd">USSD</option>
          </Select>
          <Select value={range} onChange={(e) => { setRange(e.target.value); setPage(0); }} aria-label="Date range">
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last 12 months</option>
            <option value="all">All time</option>
          </Select>
        </div>
      </Card>
      <Card pad={false}>
        <Table head={["Reference", "Member", "Plan", "Method", "Amount", "Date", "Status", ""]} minW={940}>
          {list.slice(page * PAGE, page * PAGE + PAGE).map((t) => (
            <tr key={t.id} className="hover:bg-white/40 dark:hover:bg-white/5">
              <Td className="font-mono text-xs">{t.reference}</Td>
              <Td><span className="block font-semibold">{t.memberName}</span><span className="text-xs text-slate-500">{t.email}</span></Td>
              <Td>{plans.find((p) => p.id === t.planId)?.name}</Td>
              <Td className="capitalize">{t.method}</Td>
              <Td className="font-semibold">{naira(t.amount)}</Td>
              <Td className="text-xs text-slate-500">{dateTime(t.at)}</Td>
              <Td><Badge tone={statusTone(t.status)}>{t.status}</Badge></Td>
              <Td>
                {t.status === "failed" && <Button size="sm" variant="soft" icon={<RefreshCw size={13} />} onClick={() => { upsert("txns", { ...t, status: "success", at: new Date().toISOString() }, "Retried payment", t.reference); toast(`Charge of ${naira(t.amount)} succeeded on retry.`); }}>Retry</Button>}
                {t.status === "success" && t.amount > 0 && <Button size="sm" variant="ghost" icon={<RotateCcw size={13} />} onClick={() => { upsert("txns", { ...t, status: "refunded" }, "Refunded payment", t.reference); toast(`Refunded ${naira(t.amount)}.`); }}>Refund</Button>}
              </Td>
            </tr>
          ))}
        </Table>
        <div className="flex items-center justify-between border-t border-slate-200/70 px-4 py-3 text-sm dark:border-white/10">
          <span className="text-slate-500">{list.length ? `${page * PAGE + 1}-${Math.min(list.length, page * PAGE + PAGE)} of ${list.length}` : "No transactions"}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={(page + 1) * PAGE >= list.length} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
