"use client";

import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar, Button, Card, Empty, Input, PageHeader, Select, Table, Td } from "@/components/ui";
import { dateTime, download, toCsv } from "@/lib/format";
import { useDb } from "@/lib/store";

export default function AuditPage() {
  const audit = useDb((d) => d.audit);
  const [q, setQ] = useState("");
  const [who, setWho] = useState("all");
  const people = [...new Set(audit.map((a) => a.staff))];
  const list = useMemo(() => {
    const s = q.toLowerCase();
    return audit.filter((a) => (who === "all" || a.staff === who) && (!s || a.action.toLowerCase().includes(s) || a.target.toLowerCase().includes(s)));
  }, [audit, q, who]);
  return (
    <div>
      <PageHeader title="Audit Log" sub="Every change made in the console, newest first. Kept for compliance." actions={<Button variant="outline" icon={<Download size={15} />} onClick={() => download("myflix-audit.csv", toCsv(list.map((a) => ({ time: dateTime(a.at), staff: a.staff, action: a.action, target: a.target }))))}>Export</Button>} />
      <Card className="mb-4">
        <div className="grid gap-3 md:grid-cols-3">
          <Input placeholder="Search actions…" value={q} onChange={(e) => setQ(e.target.value)} className="md:col-span-2" />
          <Select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Staff">
            <option value="all">Everyone</option>
            {people.map((p) => <option key={p}>{p}</option>)}
          </Select>
        </div>
      </Card>
      <Card pad={false}>
        {list.length === 0 ? <Empty title="No activity yet" sub="Changes made by staff will be recorded here." /> : (
          <Table head={["Time", "Staff", "Action", "Target"]} minW={640}>
            {list.slice(0, 300).map((a) => (
              <tr key={a.id}>
                <Td className="whitespace-nowrap text-xs text-slate-500">{dateTime(a.at)}</Td>
                <Td><span className="flex items-center gap-2"><Avatar name={a.staff} size={24} /> {a.staff}</span></Td>
                <Td className="font-medium">{a.action}</Td>
                <Td className="text-slate-500">{a.target}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
