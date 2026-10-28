"use client";

import { Copy, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Badge, Button, Card, Confirm, Empty, Input, PageHeader, Select, Table, Td, statusTone, useToast } from "@/components/ui";
import { GENRES, date, img, num, videoState } from "@/lib/format";
import { getDb, log, remove, uid, upsert, useDb } from "@/lib/store";
import type { Title, TitleStatus } from "@/lib/types";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "/MyFlix/";

export default function Page() {
  return (
    <Suspense>
      <ContentLibrary />
    </Suspense>
  );
}

function ContentLibrary() {
  const titles = useDb((d) => d.titles);
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [type, setType] = useState("all");
  const [genre, setGenre] = useState("all");
  const [licence, setLicence] = useState(params.get("licence") ?? "all");
  const [sort, setSort] = useState("updated");
  const [sel, setSel] = useState<string[]>([]);
  const [del, setDel] = useState<Title[] | null>(null);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const soon = Date.now() + 60 * 864e5;
    return titles
      .filter((t) => (status === "all" || t.status === status) && (type === "all" || t.type === type) && (genre === "all" || t.genres.includes(genre)))
      .filter((t) => licence === "all" || (licence === "expiring" ? t.licence?.expires && new Date(t.licence.expires).getTime() < soon : t.licence?.type === licence))
      .filter((t) => !s || t.title.toLowerCase().includes(s) || t.cast.some((c) => c.toLowerCase().includes(s)))
      .sort((a, b) =>
        sort === "views" ? b.stats.views - a.stats.views : sort === "title" ? a.title.localeCompare(b.title) : sort === "added" ? b.addedAt.localeCompare(a.addedAt) : b.updatedAt.localeCompare(a.updatedAt),
      );
  }, [titles, q, status, type, genre, licence, sort]);

  const counts = (s: TitleStatus) => titles.filter((t) => t.status === s).length;

  const bulk = (st: TitleStatus) => {
    const d = getDb();
    sel.forEach((id) => {
      const t = d.titles.find((x) => x.id === id);
      if (t) upsert("titles", { ...t, status: st, updatedAt: new Date().toISOString() });
    });
    log(`Set ${sel.length} titles to ${st}`, "Content Library");
    toast(`${sel.length} titles ${st}.`);
    setSel([]);
  };

  const duplicate = (t: Title) => {
    const copy: Title = { ...structuredClone(t), id: uid(`${t.id}-copy-`), title: `${t.title} (Copy)`, status: "draft", addedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), stats: { views: 0, watchHours: 0, completion: 0, likes: 0, trend: Array(14).fill(0) } };
    upsert("titles", copy, "Duplicated title", t.title);
    toast("Draft copy created.");
    router.push(`/content/edit?id=${copy.id}`);
  };

  return (
    <div>
      <PageHeader
        title="Content Library"
        sub={`${titles.length} titles · ${counts("published")} live · ${counts("scheduled")} scheduled · ${counts("draft")} drafts`}
        actions={<Link href="/content/edit" className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white shadow-sm shadow-brand/30 hover:bg-brand-hover"><Plus size={16} /> Add title</Link>}
      />
      <Card className="mb-4">
        <div className="grid gap-3 md:grid-cols-6">
          <Input placeholder="Search title or cast…" value={q} onChange={(e) => setQ(e.target.value)} className="md:col-span-2" />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="all">All statuses</option>
            <option value="published">Published</option>
            <option value="scheduled">Scheduled</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </Select>
          <Select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type">
            <option value="all">Movies & series</option>
            <option value="movie">Movies</option>
            <option value="series">Series</option>
          </Select>
          <Select value={genre} onChange={(e) => setGenre(e.target.value)} aria-label="Genre">
            <option value="all">All genres</option>
            {GENRES.map((g) => <option key={g}>{g}</option>)}
          </Select>
          <Select value={licence} onChange={(e) => setLicence(e.target.value)} aria-label="Licence">
            <option value="all">All licences</option>
            <option value="Original">Originals</option>
            <option value="Licensed">Licensed</option>
            <option value="expiring">Expiring in 60 days</option>
          </Select>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">Sort</span>
          <Select value={sort} onChange={(e) => setSort(e.target.value)} className="!h-8 !w-auto text-xs" aria-label="Sort">
            <option value="updated">Recently updated</option>
            <option value="added">Recently added</option>
            <option value="views">Most viewed</option>
            <option value="title">Title A-Z</option>
          </Select>
          {sel.length > 0 && (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold">{sel.length} selected</span>
              <Button size="sm" variant="soft" onClick={() => bulk("published")}>Publish</Button>
              <Button size="sm" variant="outline" onClick={() => bulk("draft")}>Unpublish</Button>
              <Button size="sm" variant="outline" onClick={() => bulk("archived")}>Archive</Button>
              <Button size="sm" variant="danger" onClick={() => setDel(titles.filter((t) => sel.includes(t.id)))}>Delete</Button>
            </div>
          )}
        </div>
      </Card>

      <Card pad={false}>
        {list.length === 0 ? (
          <Empty title="No titles match" sub="Try different filters." />
        ) : (
          <Table head={[<input key="all" type="checkbox" aria-label="Select all" checked={sel.length === list.length} onChange={(e) => setSel(e.target.checked ? list.map((t) => t.id) : [])} className="accent-brand" />, "Title", "Status", "Video", "Genres", "Views", "Updated", ""]} minW={960}>
            {list.map((t) => {
              const v = videoState(t.video ?? t.seasonsData?.[0]?.episodes.find((e) => e.video)?.video);
              return (
                <tr key={t.id} className="hover:bg-white/40 dark:hover:bg-white/5">
                  <Td><input type="checkbox" aria-label={`Select ${t.title}`} checked={sel.includes(t.id)} onChange={(e) => setSel((s) => (e.target.checked ? [...s, t.id] : s.filter((x) => x !== t.id)))} className="accent-brand" /></Td>
                  <Td>
                    <Link href={`/content/edit?id=${t.id}`} className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img(t.image, 80, 120)} alt="" className="h-14 w-10 rounded-lg object-cover" />
                      <span>
                        <span className="block font-semibold">{t.title}</span>
                        <span className="text-xs text-slate-500">
                          {t.type === "series" ? `Series · ${t.seasons} season${t.seasons === 1 ? "" : "s"}` : `Movie · ${t.runtime ?? ""}`} · {t.year} · {t.maturity}
                          {t.original && <span className="ml-1 font-semibold text-brand">· Original</span>}
                        </span>
                      </span>
                    </Link>
                  </Td>
                  <Td>
                    <Badge tone={statusTone(t.status)}>{t.status}</Badge>
                    {t.status === "scheduled" && <span className="mt-1 block text-xs text-slate-500">{date(t.releaseAt)}</span>}
                  </Td>
                  <Td><Badge tone={v.tone === "ok" ? "ok" : v.tone === "warn" ? "warn" : "muted"}>{v.label}</Badge></Td>
                  <Td className="max-w-[180px] truncate text-xs text-slate-500">{t.genres.join(", ")}</Td>
                  <Td>{num(t.stats.views)}</Td>
                  <Td className="text-xs text-slate-500">{date(t.updatedAt)}</Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <Link href={`/content/edit?id=${t.id}`} className="rounded-lg p-2 hover:bg-slate-900/5 dark:hover:bg-white/10" title="Edit"><Pencil size={15} /></Link>
                      <button onClick={() => duplicate(t)} className="rounded-lg p-2 hover:bg-slate-900/5 dark:hover:bg-white/10" title="Duplicate"><Copy size={15} /></button>
                      <a href={`${SITE}watch/?id=${t.id}`} target="_blank" rel="noreferrer" className="rounded-lg p-2 hover:bg-slate-900/5 dark:hover:bg-white/10" title="Watch on site"><ExternalLink size={15} /></a>
                      <button onClick={() => setDel([t])} className="rounded-lg p-2 text-danger hover:bg-rose-500/10" title="Delete"><Trash2 size={15} /></button>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      <Confirm
        open={Boolean(del)}
        danger
        label="Delete"
        title={`Delete ${del?.length === 1 ? `"${del[0].title}"` : `${del?.length} titles`}?`}
        body="Deleted titles disappear from MyFlix immediately. Members lose them from My List and Continue Watching. This can't be undone."
        onCancel={() => setDel(null)}
        onConfirm={() => {
          del?.forEach((t) => remove("titles", t.id, "Deleted title", t.title));
          toast(`${del?.length} title${del?.length === 1 ? "" : "s"} deleted.`);
          setSel([]);
          setDel(null);
        }}
      />
    </div>
  );
}
