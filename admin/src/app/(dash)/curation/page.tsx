"use client";

import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Card, CardTitle, Field, Input, PageHeader, Select, useToast } from "@/components/ui";
import { img } from "@/lib/format";
import { setCuration, uid, useDb } from "@/lib/store";
import type { Curation, Title } from "@/lib/types";

export default function CurationPage() {
  const titles = useDb((d) => d.titles.filter((t) => t.status === "published"));
  const saved = useDb((d) => d.curation);
  const [c, setC] = useState<Curation | null>(null);
  const toast = useToast();
  const cur = c ?? saved;
  if (!titles.length) return null;
  const set = (p: Partial<Curation>) => setC({ ...cur, ...p });
  const byId = (id?: string) => titles.find((t) => t.id === id);

  const heroSlot = (key: "heroHome" | "heroSeries" | "heroMovies" | "heroKids", label: string, filter: (t: Title) => boolean) => {
    const t = byId(cur[key]);
    return (
      <div className="overflow-hidden rounded-xl border border-slate-200/80 dark:border-white/10">
        <div className="relative aspect-video bg-slate-900/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {t && <img src={img(t.backdrop || t.image, 600, 338)} alt="" className="absolute inset-0 h-full w-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
          <p className="absolute bottom-2 left-3 font-display text-2xl text-white">{t?.title ?? "Automatic"}</p>
          <Badge tone="brand">{label}</Badge>
        </div>
        <div className="p-3">
          <Select value={cur[key] ?? ""} onChange={(e) => set({ [key]: e.target.value || undefined })} aria-label={`${label} hero`}>
            <option value="">Automatic (highest match)</option>
            {titles.filter(filter).map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
          </Select>
        </div>
      </div>
    );
  };

  const top10 = cur.top10 ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Home Curation"
        sub="Choose what members see first. Changes go live on MyFlix as soon as you publish."
        actions={
          <>
            {c && <Button variant="outline" onClick={() => setC(null)}>Discard</Button>}
            <Button disabled={!c} onClick={() => { setCuration(cur, "Published home curation"); setC(null); toast("Home screen updated on MyFlix."); }}>Publish changes</Button>
          </>
        }
      />
      <Card>
        <CardTitle title="Hero banners" sub="The big featured title at the top of each page" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {heroSlot("heroHome", "Home", () => true)}
          {heroSlot("heroSeries", "Series", (t) => t.type === "series")}
          {heroSlot("heroMovies", "Movies", (t) => t.type === "movie")}
          {heroSlot("heroKids", "Kids", (t) => Boolean(t.kids))}
        </div>
      </Card>

      <Card>
        <CardTitle
          title="Top 10 in Nigeria"
          sub="Leave empty to rank automatically by views, or pin your own order"
          right={top10.length > 0 && <Button size="sm" variant="ghost" onClick={() => set({ top10: undefined })}>Use automatic</Button>}
        />
        <TitlePicker titles={titles} selected={top10} max={10} onChange={(ids) => set({ top10: ids.length ? ids : undefined })} ranked />
      </Card>

      <Card>
        <CardTitle
          title="Custom rows"
          sub="Editorial rows shown on Home after Continue Watching"
          right={<Button size="sm" variant="soft" icon={<Plus size={14} />} onClick={() => set({ rows: [...cur.rows, { id: uid("r-"), title: "New row", titleIds: [], enabled: true }] })}>Add row</Button>}
        />
        <div className="space-y-4">
          {cur.rows.length === 0 && <p className="text-sm text-slate-500">No custom rows. Add one to promote a theme, holiday or partner.</p>}
          {cur.rows.map((r, i) => (
            <div key={r.id} className="rounded-xl border border-slate-200/80 p-3 dark:border-white/10">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Field label="Row title" className="min-w-56 flex-1">
                  <Input value={r.title} onChange={(e) => set({ rows: cur.rows.map((x) => (x.id === r.id ? { ...x, title: e.target.value } : x)) })} />
                </Field>
                <div className="flex gap-1 self-end">
                  <IconBtn title="Move up" disabled={i === 0} onClick={() => { const rows = [...cur.rows]; [rows[i - 1], rows[i]] = [rows[i], rows[i - 1]]; set({ rows }); }}><ArrowUp size={15} /></IconBtn>
                  <IconBtn title="Move down" disabled={i === cur.rows.length - 1} onClick={() => { const rows = [...cur.rows]; [rows[i + 1], rows[i]] = [rows[i], rows[i + 1]]; set({ rows }); }}><ArrowDown size={15} /></IconBtn>
                  <IconBtn title={r.enabled ? "Hide row" : "Show row"} onClick={() => set({ rows: cur.rows.map((x) => (x.id === r.id ? { ...x, enabled: !x.enabled } : x)) })}>{r.enabled ? <Eye size={15} /> : <EyeOff size={15} />}</IconBtn>
                  <IconBtn title="Delete row" danger onClick={() => set({ rows: cur.rows.filter((x) => x.id !== r.id) })}><Trash2 size={15} /></IconBtn>
                </div>
              </div>
              <TitlePicker titles={titles} selected={r.titleIds} max={20} onChange={(titleIds) => set({ rows: cur.rows.map((x) => (x.id === r.id ? { ...x, titleIds } : x)) })} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function IconBtn({ children, title, onClick, disabled, danger }: { children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button title={title} aria-label={title} disabled={disabled} onClick={onClick} className={`rounded-lg p-2 disabled:opacity-30 ${danger ? "text-danger hover:bg-rose-500/10" : "hover:bg-slate-900/5 dark:hover:bg-white/10"}`}>
      {children}
    </button>
  );
}

function TitlePicker({ titles, selected, onChange, max, ranked }: { titles: Title[]; selected: string[]; onChange: (ids: string[]) => void; max: number; ranked?: boolean }) {
  const [add, setAdd] = useState("");
  const chosen = selected.map((id) => titles.find((t) => t.id === id)).filter((t): t is Title => Boolean(t));
  return (
    <div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-2">
        {chosen.map((t, i) => (
          <div key={t.id} className="group relative w-24 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img(t.image, 160, 240)} alt="" className="aspect-[2/3] w-full rounded-lg object-cover" />
            {ranked && <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 text-xs font-bold text-white">{i + 1}</span>}
            <p className="mt-1 truncate text-xs font-semibold">{t.title}</p>
            <div className="absolute right-1 top-1 hidden gap-0.5 group-hover:flex">
              {i > 0 && <button onClick={() => { const a = [...selected]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; onChange(a); }} className="rounded bg-black/70 p-0.5 text-white" aria-label="Move left"><ArrowUp size={12} className="-rotate-90" /></button>}
              <button onClick={() => onChange(selected.filter((x) => x !== t.id))} className="rounded bg-black/70 p-0.5 text-white" aria-label="Remove"><X size={12} /></button>
            </div>
          </div>
        ))}
        {chosen.length === 0 && <p className="py-4 text-sm text-slate-500">No titles picked.</p>}
      </div>
      {selected.length < max && (
        <div className="flex max-w-md gap-2">
          <Select value={add} onChange={(e) => setAdd(e.target.value)} aria-label="Add title">
            <option value="">Add a title…</option>
            {titles.filter((t) => !selected.includes(t.id)).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </Select>
          <Button variant="outline" disabled={!add} onClick={() => { onChange([...selected, add]); setAdd(""); }}>Add</Button>
        </div>
      )}
    </div>
  );
}
