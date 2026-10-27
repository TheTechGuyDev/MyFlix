"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { NAV } from "@/components/Shell";
import { Avatar, Badge, Button, Card, CardTitle, Field, Input, Modal, PageHeader, Select, Table, Tabs, Td, useToast } from "@/components/ui";
import { DEMO_PASSWORD } from "@/lib/seed";
import { date } from "@/lib/format";
import { currentStaff, sha, uid, upsert, useDb } from "@/lib/store";
import type { Role, Section, Staff } from "@/lib/types";

export default function StaffPage() {
  const staff = useDb((d) => d.staff);
  const roles = useDb((d) => d.roles);
  const me = useDb((d) => currentStaff(d));
  const toast = useToast();
  const [tab, setTab] = useState<"staff" | "roles">("staff");
  const [invite, setInvite] = useState<{ name: string; email: string; roleId: string } | null>(null);
  const [newRole, setNewRole] = useState("");

  const togglePerm = (r: Role, s: Section) => {
    if (r.system) return;
    const permissions = r.permissions.includes(s) ? r.permissions.filter((x) => x !== s) : [...r.permissions, s];
    upsert("roles", { ...r, permissions }, `Updated ${r.name} permissions`, s);
  };

  return (
    <div>
      <PageHeader title="Staff & Roles" sub="Who can access the console and what each role can do." />
      <Tabs tabs={[{ id: "staff", label: "Staff", count: staff.length }, { id: "roles", label: "Roles & permissions", count: roles.length }]} value={tab} onChange={setTab} />
      {tab === "staff" && (
        <Card pad={false}>
          <div className="flex justify-end p-4 pb-0"><Button icon={<Plus size={15} />} onClick={() => setInvite({ name: "", email: "", roleId: "content_manager" })}>Add staff</Button></div>
          <Table head={["Name", "Role", "Status", "Last sign-in", "Added", ""]} minW={760}>
            {staff.map((s) => (
              <tr key={s.id}>
                <Td>
                  <span className="flex items-center gap-3">
                    <Avatar name={s.name} index={s.avatar} />
                    <span><span className="block font-semibold">{s.name} {s.id === me?.id && <Badge tone="brand">You</Badge>}</span><span className="text-xs text-slate-500">{s.email}</span></span>
                  </span>
                </Td>
                <Td>
                  <Select value={s.roleId} disabled={s.id === me?.id} onChange={(e) => { upsert("staff", { ...s, roleId: e.target.value }, "Changed staff role", s.email); toast("Role updated."); }} className="!w-48" aria-label="Role">
                    {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </Select>
                </Td>
                <Td><Badge tone={s.active ? "ok" : "muted"}>{s.active ? "Active" : "Deactivated"}</Badge></Td>
                <Td className="text-xs text-slate-500">{s.lastLogin ? date(s.lastLogin) : "Never"}</Td>
                <Td className="text-xs text-slate-500">{date(s.createdAt)}</Td>
                <Td>
                  {s.id !== me?.id && (
                    <Button size="sm" variant="ghost" onClick={() => { upsert("staff", { ...s, active: !s.active }, s.active ? "Deactivated staff" : "Reactivated staff", s.email); toast(s.active ? "Access removed." : "Access restored."); }}>
                      {s.active ? "Deactivate" : "Reactivate"}
                    </Button>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
      {tab === "roles" && (
        <Card>
          <CardTitle title="Permission matrix" sub="Tick the sections each role can open. Super Admin always has full access." />
          <div className="thin-scroll overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-slate-200/70 text-xs text-slate-500 dark:border-white/10">
                  <th className="py-2 text-left">Section</th>
                  {roles.map((r) => <th key={r.id} className="px-2 py-2">{r.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {NAV.map((n) => (
                  <tr key={n.section} className="border-b border-slate-200/50 dark:border-white/5">
                    <td className="py-2 font-medium">{n.label}</td>
                    {roles.map((r) => (
                      <td key={r.id} className="text-center">
                        <input type="checkbox" aria-label={`${r.name} ${n.label}`} checked={r.permissions.includes(n.section)} disabled={r.system} onChange={() => togglePerm(r, n.section)} className="h-4 w-4 accent-brand" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex max-w-md gap-2">
            <Input value={newRole} onChange={(e) => setNewRole(e.target.value)} placeholder="New role name, e.g. Studio Partner" />
            <Button variant="soft" disabled={!newRole.trim()} onClick={() => { upsert("roles", { id: uid("role-"), name: newRole.trim(), permissions: ["overview"] }, "Created role", newRole.trim()); setNewRole(""); toast("Role created."); }}>Add role</Button>
          </div>
        </Card>
      )}

      <Modal
        open={Boolean(invite)}
        onClose={() => setInvite(null)}
        title="Add staff member"
        footer={
          <>
            <Button variant="outline" onClick={() => setInvite(null)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!invite?.name.trim() || !/^\S+@\S+\.\S+$/.test(invite.email)) return toast("Enter a name and a valid email.", "bad");
                if (staff.some((s) => s.email.toLowerCase() === invite.email.toLowerCase())) return toast("That email already has an account.", "bad");
                const s: Staff = { id: uid("s"), name: invite.name.trim(), email: invite.email.trim().toLowerCase(), passwordHash: await sha(DEMO_PASSWORD), roleId: invite.roleId, active: true, createdAt: new Date().toISOString(), avatar: staff.length };
                upsert("staff", s, "Added staff", s.email);
                setInvite(null);
                toast(`Invite sent. Temporary password: ${DEMO_PASSWORD}`);
              }}
            >
              Send invite
            </Button>
          </>
        }
      >
        {invite && (
          <div className="space-y-3">
            <Field label="Full name"><Input value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} /></Field>
            <Field label="Work email"><Input type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} /></Field>
            <Field label="Role">
              <Select value={invite.roleId} onChange={(e) => setInvite({ ...invite, roleId: e.target.value })}>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </Select>
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
