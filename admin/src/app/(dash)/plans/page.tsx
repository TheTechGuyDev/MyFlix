"use client";

import { Copy, Gift, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Card, CardTitle, Field, Input, Modal, PageHeader, Select, Table, Tabs, Td, Toggle, useToast } from "@/components/ui";
import { date, naira } from "@/lib/format";
import { allMembers, log, remove, uid, upsert, useDb } from "@/lib/store";
import type { GiftCard, Plan, Promo } from "@/lib/types";

export default function PlansPage() {
  const [tab, setTab] = useState<"plans" | "promos" | "gifts">("plans");
  const plans = useDb((d) => d.plans);
  const promos = useDb((d) => d.promos);
  const gifts = useDb((d) => d.gifts);
  const members = useDb((d) => allMembers(d));
  const toast = useToast();
  const [editPlan, setEditPlan] = useState<Plan | null>(null);
  const [editPromo, setEditPromo] = useState<Promo | null>(null);
  const [giftAmt, setGiftAmt] = useState(10000);
  const [giftQty, setGiftQty] = useState(1);

  return (
    <div>
      <PageHeader title="Plans & Promos" sub="Pricing changes update the MyFlix sign-up page and account page immediately." />
      <Tabs tabs={[{ id: "plans", label: "Plans", count: plans.length }, { id: "promos", label: "Promo codes", count: promos.length }, { id: "gifts", label: "Gift cards", count: gifts.length }]} value={tab} onChange={setTab} />

      {tab === "plans" && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {plans.map((p) => {
              const subs = members.filter((m) => m.planId === p.id && m.status === "active").length;
              return (
                <Card key={p.id} className={p.active ? "" : "opacity-60"}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-lg font-bold">{p.name}</p>
                      <p className="text-2xl font-bold">{naira(p.price)}<span className="text-sm font-normal text-slate-500">/mo</span></p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {p.badge && <Badge tone="brand">{p.badge}</Badge>}
                      {!p.active && <Badge>Hidden</Badge>}
                      {p.adSupported && <Badge tone="info">With ads</Badge>}
                    </div>
                  </div>
                  <ul className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                    <li>{p.resolution}</li>
                    <li>{p.screens} screen{p.screens > 1 ? "s" : ""} at once · {p.downloads} download device{p.downloads > 1 ? "s" : ""}</li>
                    <li>{p.devices}</li>
                    {p.annualDiscount ? <li>Annual: {naira(p.price * 12 * (1 - p.annualDiscount / 100))} ({p.annualDiscount}% off)</li> : null}
                  </ul>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-200/70 pt-3 text-sm dark:border-white/10">
                    <span><b>{subs}</b> active · <b>{naira(subs * p.price)}</b>/mo</span>
                    <Button size="sm" variant="soft" icon={<Pencil size={13} />} onClick={() => setEditPlan({ ...p })}>Edit</Button>
                  </div>
                </Card>
              );
            })}
          </div>
          <Button className="mt-4" variant="outline" icon={<Plus size={15} />} onClick={() => setEditPlan({ id: "", name: "", price: 3000, resolution: "1080p (Full HD)", quality: "Great", devices: "TV, computer, phone, tablet", screens: 2, downloads: 2, active: true, annualDiscount: 15 })}>Add plan</Button>
        </>
      )}

      {tab === "promos" && (
        <Card pad={false}>
          <div className="flex justify-end p-4 pb-0">
            <Button icon={<Plus size={15} />} onClick={() => setEditPromo({ id: "", code: "", kind: "percent", value: 20, plans: plans.map((p) => p.id), maxUses: 1000, used: 0, active: true, createdAt: new Date().toISOString() })}>New promo code</Button>
          </div>
          <Table head={["Code", "Discount", "Plans", "Usage", "Expires", "Status", ""]} minW={800}>
            {promos.map((p) => (
              <tr key={p.id}>
                <Td><code className="rounded bg-slate-900/5 px-2 py-1 font-bold dark:bg-white/10">{p.code}</code></Td>
                <Td>{p.kind === "percent" ? `${p.value}% off` : p.kind === "amount" ? `${naira(p.value)} off` : `${p.value} free month${p.value > 1 ? "s" : ""}`}</Td>
                <Td className="text-xs">{p.plans.map((id) => plans.find((x) => x.id === id)?.name).join(", ")}</Td>
                <Td>
                  <span className="text-sm">{p.used.toLocaleString()} / {p.maxUses.toLocaleString()}</span>
                  <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-slate-900/10 dark:bg-white/10"><div className="h-full bg-brand" style={{ width: `${Math.min(100, (p.used / p.maxUses) * 100)}%` }} /></div>
                </Td>
                <Td className="text-xs text-slate-500">{p.expiresAt ? date(p.expiresAt) : "Never"}</Td>
                <Td><Badge tone={p.active ? "ok" : "muted"}>{p.active ? "Active" : "Paused"}</Badge></Td>
                <Td>
                  <div className="flex justify-end gap-1">
                    <button className="rounded-lg p-2 hover:bg-slate-900/5 dark:hover:bg-white/10" title="Edit" onClick={() => setEditPromo({ ...p })}><Pencil size={15} /></button>
                    <button className="rounded-lg p-2 text-danger hover:bg-rose-500/10" title="Delete" onClick={() => { remove("promos", p.id, "Deleted promo code", p.code); toast("Promo deleted."); }}><Trash2 size={15} /></button>
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {tab === "gifts" && (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Card>
            <CardTitle title="Issue gift cards" sub="For partners, giveaways and corporate gifting" />
            <div className="space-y-3">
              <Field label="Value (₦)">
                <Select value={giftAmt} onChange={(e) => setGiftAmt(Number(e.target.value))}>
                  {[5000, 10000, 15000, 25000, 50000].map((a) => <option key={a} value={a}>{naira(a)}</option>)}
                </Select>
              </Field>
              <Field label="How many">
                <Input type="number" min={1} max={500} value={giftQty} onChange={(e) => setGiftQty(Math.max(1, Math.min(500, Number(e.target.value))))} />
              </Field>
              <Button
                className="w-full"
                icon={<Gift size={15} />}
                onClick={() => {
                  for (let i = 0; i < giftQty; i++) {
                    const g: GiftCard = { id: uid("g"), code: `MYF-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, amount: giftAmt, balance: giftAmt, createdAt: new Date().toISOString() };
                    upsert("gifts", g);
                  }
                  log(`Issued ${giftQty} gift card${giftQty > 1 ? "s" : ""} of ${naira(giftAmt)}`, "Gift cards");
                  toast(`${giftQty} gift card${giftQty > 1 ? "s" : ""} created.`);
                }}
              >
                Generate
              </Button>
            </div>
          </Card>
          <Card pad={false}>
            <Table head={["Code", "Value", "Balance", "Created", "Status", ""]} minW={640}>
              {gifts.map((g) => (
                <tr key={g.id}>
                  <Td><code className="font-bold">{g.code}</code></Td>
                  <Td>{naira(g.amount)}</Td>
                  <Td>{naira(g.balance)}</Td>
                  <Td className="text-xs text-slate-500">{date(g.createdAt)}</Td>
                  <Td>{g.balance === 0 ? <Badge>Redeemed{g.redeemedBy ? ` by ${g.redeemedBy}` : ""}</Badge> : <Badge tone="ok">Unused</Badge>}</Td>
                  <Td><button className="rounded-lg p-2 hover:bg-slate-900/5 dark:hover:bg-white/10" title="Copy code" onClick={() => { navigator.clipboard?.writeText(g.code); toast("Code copied."); }}><Copy size={15} /></button></Td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>
      )}

      <Modal
        open={Boolean(editPlan)}
        onClose={() => setEditPlan(null)}
        title={editPlan?.id ? `Edit ${editPlan.name}` : "New plan"}
        footer={
          <>
            {editPlan?.id && <Button variant="ghost" className="mr-auto text-danger" onClick={() => { remove("plans", editPlan.id, "Deleted plan", editPlan.name); setEditPlan(null); toast("Plan deleted."); }}>Delete</Button>}
            <Button variant="outline" onClick={() => setEditPlan(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!editPlan || !editPlan.name.trim() || editPlan.price < 0) return toast("Name and price are required.", "bad");
                const p = { ...editPlan, id: editPlan.id || editPlan.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") };
                upsert("plans", p, editPlan.id ? "Updated plan" : "Created plan", `${p.name} (${naira(p.price)})`);
                setEditPlan(null);
                toast("Plan saved. MyFlix sign-up now shows the new details.");
              }}
            >
              Save plan
            </Button>
          </>
        }
      >
        {editPlan && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name"><Input value={editPlan.name} onChange={(e) => setEditPlan({ ...editPlan, name: e.target.value })} /></Field>
            <Field label="Monthly price (₦)"><Input type="number" value={editPlan.price} onChange={(e) => setEditPlan({ ...editPlan, price: Number(e.target.value) })} /></Field>
            <Field label="Max resolution">
              <Select value={editPlan.resolution} onChange={(e) => setEditPlan({ ...editPlan, resolution: e.target.value })}>
                {["480p", "720p (HD)", "1080p (Full HD)", "4K (Ultra HD) + HDR"].map((r) => <option key={r}>{r}</option>)}
              </Select>
            </Field>
            <Field label="Quality label">
              <Select value={editPlan.quality} onChange={(e) => setEditPlan({ ...editPlan, quality: e.target.value })}>
                {["Fair", "Good", "Great", "Best"].map((r) => <option key={r}>{r}</option>)}
              </Select>
            </Field>
            <Field label="Screens at once"><Input type="number" min={1} max={6} value={editPlan.screens} onChange={(e) => setEditPlan({ ...editPlan, screens: Number(e.target.value) })} /></Field>
            <Field label="Download devices"><Input type="number" min={0} max={10} value={editPlan.downloads} onChange={(e) => setEditPlan({ ...editPlan, downloads: Number(e.target.value) })} /></Field>
            <Field label="Supported devices" className="sm:col-span-2"><Input value={editPlan.devices} onChange={(e) => setEditPlan({ ...editPlan, devices: e.target.value })} /></Field>
            <Field label="Badge (optional)"><Input value={editPlan.badge ?? ""} onChange={(e) => setEditPlan({ ...editPlan, badge: e.target.value || undefined })} placeholder="Most Popular" /></Field>
            <Field label="Annual discount %"><Input type="number" min={0} max={50} value={editPlan.annualDiscount ?? 0} onChange={(e) => setEditPlan({ ...editPlan, annualDiscount: Number(e.target.value) })} /></Field>
            <div className="sm:col-span-2">
              <Toggle label="Visible on sign-up page" on={editPlan.active} onChange={(v) => setEditPlan({ ...editPlan, active: v })} />
              <Toggle label="Ad-supported plan" sub="Cheaper plan with short ad breaks" on={Boolean(editPlan.adSupported)} onChange={(v) => setEditPlan({ ...editPlan, adSupported: v })} />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(editPromo)}
        onClose={() => setEditPromo(null)}
        title={editPromo?.id ? `Edit ${editPromo.code}` : "New promo code"}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditPromo(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!editPromo || !/^[A-Z0-9]{3,20}$/.test(editPromo.code)) return toast("Use 3-20 capital letters or numbers for the code.", "bad");
                const p = { ...editPromo, id: editPromo.id || uid("p") };
                upsert("promos", p, editPromo.id ? "Updated promo" : "Created promo", p.code);
                setEditPromo(null);
                toast("Promo saved.");
              }}
            >
              Save
            </Button>
          </>
        }
      >
        {editPromo && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Code" className="sm:col-span-2"><Input value={editPromo.code} onChange={(e) => setEditPromo({ ...editPromo, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} placeholder="EASTER30" /></Field>
            <Field label="Discount type">
              <Select value={editPromo.kind} onChange={(e) => setEditPromo({ ...editPromo, kind: e.target.value as Promo["kind"] })}>
                <option value="percent">Percent off</option>
                <option value="amount">Naira off</option>
                <option value="free_months">Free months</option>
              </Select>
            </Field>
            <Field label="Value"><Input type="number" value={editPromo.value} onChange={(e) => setEditPromo({ ...editPromo, value: Number(e.target.value) })} /></Field>
            <Field label="Max uses"><Input type="number" value={editPromo.maxUses} onChange={(e) => setEditPromo({ ...editPromo, maxUses: Number(e.target.value) })} /></Field>
            <Field label="Expires"><Input type="date" value={editPromo.expiresAt?.slice(0, 10) ?? ""} onChange={(e) => setEditPromo({ ...editPromo, expiresAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })} /></Field>
            <div className="sm:col-span-2">
              <p className="mb-1.5 text-xs font-semibold">Applies to</p>
              <div className="flex flex-wrap gap-2">
                {plans.map((pl) => {
                  const on = editPromo.plans.includes(pl.id);
                  return <button key={pl.id} onClick={() => setEditPromo({ ...editPromo, plans: on ? editPromo.plans.filter((x) => x !== pl.id) : [...editPromo.plans, pl.id] })} className={`rounded-full px-3 py-1 text-xs font-semibold ${on ? "bg-brand text-white" : "bg-slate-900/5 dark:bg-white/5"}`}>{pl.name}</button>;
                })}
              </div>
            </div>
            <div className="sm:col-span-2"><Toggle label="Active" on={editPromo.active} onChange={(v) => setEditPromo({ ...editPromo, active: v })} /></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
