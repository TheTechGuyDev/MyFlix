"use client";

import { ArrowLeft, ExternalLink, ImagePlus, Plus, Save, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import VideoUploader from "@/components/VideoUploader";
import { Badge, Button, Card, CardTitle, Field, Input, Select, Stat, Tabs, Textarea, Toggle, statusTone, useToast } from "@/components/ui";
import { GENRES, LANGS, chartTip, date, img, naira, num } from "@/lib/format";
import { deleteSubtitle, srtToVtt, uploadArtwork, uploadSubtitle } from "@/lib/media";
import { getDb, log, saveTitleNow, uid, useDb } from "@/lib/store";
import type { Episode, Maturity, Season, Subtitle, Title, TitleStatus } from "@/lib/types";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "/MyFlix/";
type TabId = "details" | "artwork" | "video" | "tracks" | "rights" | "stats";

export default function Page() {
  return (
    <Suspense>
      <Editor />
    </Suspense>
  );
}

const blank = (): Title => ({
  id: "",
  title: "",
  image: "",
  type: "movie",
  year: new Date().getFullYear(),
  maturity: "13+",
  genres: [],
  runtime: "",
  synopsis: "",
  cast: [],
  directors: [],
  tags: [],
  match: 90,
  quality: "4K",
  status: "draft",
  languages: ["English"],
  subtitles: [],
  audioTracks: [{ id: uid("a"), lang: "en", label: "English (Original)" }],
  stats: { views: 0, watchHours: 0, completion: 0, likes: 0, trend: Array(14).fill(0) },
  addedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const slug = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const comingLabel = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }).replace(",", "");

function Editor() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const id = params.get("id");
  const existing = useDb((d) => (id ? d.titles.find((t) => t.id === id) : undefined));
  const live = existing;
  const loaded = useDb((d) => d.titles.length > 0);
  const [t, setT] = useState<Title | null>(null);
  const [tab, setTab] = useState<TabId>("details");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!loaded || t) return;
    if (existing) {
      const copy = structuredClone(existing);
      if (copy.type === "series" && !copy.seasonsData?.length) copy.seasonsData = [{ number: 1, episodes: [] }];
      setT(copy);
    } else setT(blank());
  }, [loaded, existing, t]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => dirty && e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (!t) return null;
  const set = (p: Partial<Title>) => {
    setT({ ...t, ...p });
    setDirty(true);
  };

  const save = async (status?: TitleStatus, quiet = false): Promise<string | null> => {
    const e: Record<string, string> = {};
    if (!t.title.trim()) e.title = "Title is required.";
    if (!t.synopsis.trim()) e.synopsis = "Add a short synopsis.";
    if (!t.genres.length) e.genres = "Pick at least one genre.";
    if (!t.image) e.image = "Add a poster.";
    const st = status ?? t.status;
    if (st === "scheduled" && !t.releaseAt) e.releaseAt = "Choose a release date for scheduled titles.";
    setErrors(e);
    if (Object.keys(e).length) {
      toast("Fix the highlighted fields first.", "bad");
      if (e.title || e.synopsis || e.genres) setTab("details");
      else if (e.image) setTab("artwork");
      else setTab("rights");
      return null;
    }
    const now = new Date().toISOString();
    let newId = t.id;
    if (!newId) {
      newId = slug(t.title) || uid("title-");
      if (getDb().titles.some((x) => x.id === newId)) newId = `${newId}-${Math.random().toString(36).slice(2, 5)}`;
    }
    const scheduledFuture = st === "scheduled" && t.releaseAt && new Date(t.releaseAt).getTime() > Date.now();
    const final: Title = {
      ...t,
      id: newId,
      status: st,
      seasons: t.type === "series" ? t.seasonsData?.length ?? 1 : undefined,
      seasonsData: t.type === "series" ? t.seasonsData ?? [{ number: 1, episodes: [] }] : undefined,
      runtime: t.type === "movie" ? t.runtime || (live?.video?.duration ? `${Math.floor(live.video.duration / 3600)}h ${Math.round((live.video.duration % 3600) / 60)}m` : "") : undefined,
      comingSoon: scheduledFuture ? comingLabel(t.releaseAt!) : undefined,
      quality: live?.video?.height ? (live.video.height >= 2160 ? "4K" : "HD") : t.quality,
      updatedAt: now,
      addedAt: t.addedAt || now,
    };
    if (st === "published" && !quiet) {
      const hasVideo = final.type === "movie" ? live?.video?.status === "ready" : live?.seasonsData?.some((s) => s.episodes.some((e) => e.video?.status === "ready"));
      if (!hasVideo && !final.sample && !confirm("This title has no ready video yet. Members will see it but can't play it. Publish anyway?")) return null;
    }
    const ok = await saveTitleNow(final);
    if (!ok) {
      toast("Couldn't save. Check your connection and try again.", "bad");
      return null;
    }
    log(t.id ? (st !== existing?.status ? `Set status to ${st}` : "Edited title") : "Created title", final.title);
    setT(final);
    setDirty(false);
    if (!quiet) toast(st === "published" ? `"${final.title}" is live on MyFlix.` : st === "scheduled" ? `"${final.title}" scheduled for ${date(final.releaseAt)}.` : "Saved.");
    if (!t.id) router.replace(`/content/edit?id=${newId}`);
    return newId;
  };
  const ensureSaved = () => save(undefined, true);

  const tabs: { id: TabId; label: string }[] = [
    { id: "details", label: "Details" },
    { id: "artwork", label: "Artwork" },
    { id: "video", label: t.type === "series" ? "Seasons & Episodes" : "Video" },
    { id: "tracks", label: "Subtitles & Audio" },
    { id: "rights", label: "Availability & Rights" },
    ...(t.id ? [{ id: "stats" as TabId, label: "Performance" }] : []),
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link href="/content" className="rounded-xl p-2 hover:bg-white/70 dark:hover:bg-white/10" aria-label="Back"><ArrowLeft size={18} /></Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold">{t.title || "New title"}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <Badge tone={statusTone(t.status)}>{t.status}</Badge>
            {t.id && <span>Updated {date(t.updatedAt)}</span>}
            {dirty && <Badge tone="warn">Unsaved changes</Badge>}
          </div>
        </div>
        {t.id && t.status === "published" && (
          <a href={`${SITE}watch/?id=${t.id}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold hover:bg-white/70 dark:hover:bg-white/10">
            Watch on MyFlix <ExternalLink size={14} />
          </a>
        )}
        <Button variant="outline" onClick={() => save("draft")} icon={<Save size={15} />}>Save draft</Button>
        <Button variant="outline" onClick={() => { if (!t.releaseAt) { setTab("rights"); toast("Pick a release date in Availability, then schedule.", "bad"); return; } save("scheduled"); }}>Schedule</Button>
        <Button onClick={() => save("published")}>Publish</Button>
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === "details" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="space-y-4 lg:col-span-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title" error={errors.title} className="sm:col-span-2">
                <Input value={t.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Eko Nights" />
              </Field>
              <Field label="Type">
                <Select
                  value={t.type}
                  disabled={Boolean(t.id)}
                  onChange={(e) => {
                    const type = e.target.value as Title["type"];
                    set({ type, seasonsData: type === "series" ? t.seasonsData ?? [{ number: 1, episodes: [] }] : undefined });
                  }}
                >
                  <option value="movie">Movie</option>
                  <option value="series">Series</option>
                </Select>
              </Field>
              <Field label="Release year">
                <Input type="number" value={t.year} onChange={(e) => set({ year: Number(e.target.value) })} />
              </Field>
              {t.type === "movie" && (
                <Field label="Runtime" hint="Filled from the video if left empty">
                  <Input value={t.runtime ?? ""} onChange={(e) => set({ runtime: e.target.value })} placeholder="1h 52m" />
                </Field>
              )}
              <Field label="Maturity rating">
                <Select value={t.maturity} onChange={(e) => set({ maturity: e.target.value as Maturity })}>
                  {["All", "7+", "13+", "16+", "18+"].map((m) => <option key={m}>{m}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Synopsis" error={errors.synopsis} hint={`${t.synopsis.length}/300 characters`}>
              <Textarea value={t.synopsis} maxLength={300} onChange={(e) => set({ synopsis: e.target.value })} placeholder="One or two sentences that make people press play." />
            </Field>
            <ChipInput label="Cast" values={t.cast} onChange={(cast) => set({ cast })} placeholder="Type a name and press Enter" />
            <ChipInput label="Directors" values={t.directors ?? []} onChange={(directors) => set({ directors })} placeholder="Type a name and press Enter" />
            <ChipInput label="Mood tags" values={t.tags} onChange={(tags) => set({ tags })} placeholder="e.g. Suspenseful, Feel-good" />
          </Card>
          <div className="space-y-4">
            <Card>
              <CardTitle title="Genres" sub="Used for rows, search and recommendations" />
              {errors.genres && <p className="mb-2 text-xs text-danger">{errors.genres}</p>}
              <div className="flex flex-wrap gap-1.5">
                {GENRES.map((g) => {
                  const on = t.genres.includes(g);
                  return (
                    <button key={g} onClick={() => set({ genres: on ? t.genres.filter((x) => x !== g) : [...t.genres, g] })} className={`rounded-full px-3 py-1 text-xs font-semibold transition ${on ? "bg-brand text-white" : "bg-slate-900/5 hover:bg-slate-900/10 dark:bg-white/5 dark:hover:bg-white/10"}`}>
                      {g}
                    </button>
                  );
                })}
              </div>
            </Card>
            <Card>
              <CardTitle title="Flags" />
              <Toggle label="MyFlix Original" sub="Shows the M badge and Only on MyFlix row" on={Boolean(t.original)} onChange={(v) => set({ original: v })} />
              <Toggle label="Kids profile" sub="Visible on Kids profiles" on={Boolean(t.kids)} onChange={(v) => set({ kids: v })} />
              <Toggle label="Mark as New" sub="NEW badge and New Releases row" on={Boolean(t.isNew)} onChange={(v) => set({ isNew: v })} />
              <Field label="Predicted match %" hint="Default score before personalisation">
                <Input type="number" min={50} max={99} value={t.match} onChange={(e) => set({ match: Number(e.target.value) })} />
              </Field>
            </Card>
          </div>
        </div>
      )}

      {tab === "artwork" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ArtworkCard label="Poster (2:3)" hint="Shown in rows, search and on mobile" value={t.image} ratio="aspect-[2/3] max-w-[220px]" error={errors.image} onChange={(image) => set({ image })} />
          <ArtworkCard label="Backdrop (16:9)" hint="Hero banners and details page. Falls back to the poster." value={t.backdrop ?? ""} ratio="aspect-video" onChange={(backdrop) => set({ backdrop: backdrop || undefined })} />
        </div>
      )}

      {tab === "video" && t.type === "movie" && (
        <Card>
          <CardTitle title="Feature video" sub="Upload the master file (up to 4K). Mux encodes it for adaptive streaming from 480p up to the source resolution." />
          <VideoUploader titleId={t.id || undefined} value={live?.video} ensureSaved={ensureSaved} />
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field label="Skip Intro starts (sec)"><Input type="number" value={t.introStart ?? ""} onChange={(e) => set({ introStart: e.target.value ? Number(e.target.value) : undefined })} /></Field>
            <Field label="Skip Intro ends (sec)"><Input type="number" value={t.introEnd ?? ""} onChange={(e) => set({ introEnd: e.target.value ? Number(e.target.value) : undefined })} /></Field>
          </div>
        </Card>
      )}

      {tab === "video" && t.type === "series" && <SeasonsEditor titleId={t.id} live={live} seasons={t.seasonsData ?? []} onChange={(seasonsData) => set({ seasonsData })} ensureSaved={ensureSaved} />}

      {tab === "tracks" && <TracksEditor t={t} set={set} assetId={live?.video?.asset_id} ensureSaved={ensureSaved} />}

      {tab === "rights" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-4">
            <CardTitle title="Availability" />
            <Field label="Status">
              <Select value={t.status} onChange={(e) => set({ status: e.target.value as TitleStatus })}>
                <option value="draft">Draft (hidden)</option>
                <option value="scheduled">Scheduled (Coming Soon until release)</option>
                <option value="published">Published (live)</option>
                <option value="archived">Archived (hidden, kept for records)</option>
              </Select>
            </Field>
            <Field label="Release date & time" error={errors.releaseAt} hint="Scheduled titles appear in Coming Soon and go live automatically">
              <Input type="datetime-local" value={t.releaseAt ? t.releaseAt.slice(0, 16) : ""} onChange={(e) => set({ releaseAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })} />
            </Field>
            <Field label="Leaves MyFlix on" hint="Optional. The title is hidden after this date">
              <Input type="date" value={t.expiresAt ? t.expiresAt.slice(0, 10) : ""} onChange={(e) => set({ expiresAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })} />
            </Field>
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">Spoken languages</p>
              <div className="flex flex-wrap gap-1.5">
                {LANGS.map((l) => {
                  const on = t.languages?.includes(l.label);
                  return (
                    <button key={l.code} onClick={() => set({ languages: on ? t.languages?.filter((x) => x !== l.label) : [...(t.languages ?? []), l.label] })} className={`rounded-full px-3 py-1 text-xs font-semibold ${on ? "bg-brand text-white" : "bg-slate-900/5 dark:bg-white/5"}`}>
                      {l.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>
          <Card className="space-y-4">
            <CardTitle title="Rights & licence" sub="Track who owns the title and when the licence ends" />
            <Field label="Licence type">
              <Select value={t.licence?.type ?? "Licensed"} onChange={(e) => set({ licence: { owner: t.licence?.owner ?? "", ...t.licence, type: e.target.value as "Original" } })}>
                <option>Original</option>
                <option>Licensed</option>
                <option>Co-production</option>
              </Select>
            </Field>
            <Field label="Rights holder">
              <Input value={t.licence?.owner ?? ""} onChange={(e) => set({ licence: { type: "Licensed", ...t.licence, owner: e.target.value } })} placeholder="Studio or distributor" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Licence expires">
                <Input type="date" value={t.licence?.expires?.slice(0, 10) ?? ""} onChange={(e) => set({ licence: { type: "Licensed", owner: "", ...t.licence, expires: e.target.value ? new Date(e.target.value).toISOString() : undefined } })} />
              </Field>
              <Field label="Licence cost (₦)">
                <Input type="number" value={t.licence?.cost ?? ""} onChange={(e) => set({ licence: { type: "Licensed", owner: "", ...t.licence, cost: e.target.value ? Number(e.target.value) : undefined } })} />
              </Field>
            </div>
            {t.licence?.cost && t.stats.views > 0 ? (
              <p className="rounded-xl bg-brand/10 p-3 text-sm">Cost per view so far: <b>{naira(t.licence.cost / t.stats.views)}</b></p>
            ) : null}
          </Card>
        </div>
      )}

      {tab === "stats" && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Views" value={num(t.stats.views)} />
            <Stat label="Watch hours" value={num(t.stats.watchHours)} />
            <Stat label="Completion rate" value={`${t.stats.completion}%`} />
            <Stat label="Likes" value={num(t.stats.likes)} />
          </div>
          <Card>
            <CardTitle title="Daily views" sub="Last 14 days" />
            <div className="h-56">
              <ResponsiveContainer>
                <AreaChart data={t.stats.trend.map((v, i) => ({ day: `D${i + 1}`, views: v }))}>
                  <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} />
                  <Tooltip {...chartTip} />
                  <Area dataKey="views" stroke="#0d9b5f" fill="#0d9b5f" fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function ChipInput({ label, values, onChange, placeholder }: { label: string; values: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [v, setV] = useState("");
  const add = () => {
    const s = v.trim();
    if (s && !values.includes(s)) onChange([...values, s]);
    setV("");
  };
  return (
    <Field label={label}>
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-300/80 bg-white/70 p-1.5 dark:border-white/10 dark:bg-white/5">
        {values.map((x) => (
          <span key={x} className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand dark:text-brand-bright">
            {x}
            <button type="button" onClick={() => onChange(values.filter((y) => y !== x))} aria-label={`Remove ${x}`}><X size={12} /></button>
          </span>
        ))}
        <input
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          placeholder={placeholder}
          className="h-7 min-w-32 flex-1 bg-transparent px-1 text-sm outline-none"
        />
      </div>
    </Field>
  );
}

function ArtworkCard({ label, hint, value, ratio, error, onChange }: { label: string; hint: string; value: string; ratio: string; error?: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [err, setErr] = useState("");
  return (
    <Card>
      <CardTitle title={label} sub={hint} />
      <div className={`relative w-full overflow-hidden rounded-xl bg-slate-900/5 dark:bg-white/5 ${ratio}`}>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img(value, 800)} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <button onClick={() => ref.current?.click()} className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
            <ImagePlus size={28} />
            <span className="mt-1 text-xs">Upload image</span>
          </button>
        )}
      </div>
      {(error || err) && <p className="mt-2 text-xs text-danger">{error || err}</p>}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            setErr("Uploading…");
            onChange(await uploadArtwork(f, label.startsWith("Poster") ? 800 : 1920));
            setErr("");
          } catch (x) {
            setErr(x instanceof Error ? x.message : "Couldn't upload that image.");
          }
          e.target.value = "";
        }}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="soft" onClick={() => ref.current?.click()} icon={<ImagePlus size={14} />}>Upload</Button>
        {value && <Button size="sm" variant="ghost" onClick={() => onChange("")} icon={<Trash2 size={14} />}>Remove</Button>}
      </div>
      <div className="mt-3 flex gap-2">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="or paste an image URL" />
        <Button size="sm" variant="outline" className="!h-10" onClick={() => { if (/^https?:\/\//.test(url)) { onChange(url); setUrl(""); setErr(""); } else setErr("Enter a full https:// image link."); }}>Use</Button>
      </div>
    </Card>
  );
}

function SeasonsEditor({ titleId, live, seasons, onChange, ensureSaved }: { titleId: string; live?: Title; seasons: Season[]; onChange: (s: Season[]) => void; ensureSaved: () => Promise<string | null> }) {
  const liveVideo = (epId: string) => live?.seasonsData?.flatMap((x) => x.episodes).find((e) => e.id === epId)?.video;
  const [active, setActive] = useState(seasons[0]?.number ?? 1);
  const s = seasons.find((x) => x.number === active);
  const update = (sn: Season) => onChange(seasons.map((x) => (x.number === sn.number ? sn : x)));
  const addSeason = () => {
    const n = (seasons[seasons.length - 1]?.number ?? 0) + 1;
    onChange([...seasons, { number: n, episodes: [] }]);
    setActive(n);
  };
  const addEpisode = () => {
    if (!s) return;
    const ep: Episode = { id: uid("ep"), number: s.episodes.length + 1, title: `Episode ${s.episodes.length + 1}`, runtime: "45m", synopsis: "" };
    update({ ...s, episodes: [...s.episodes, ep] });
  };
  const setEp = (ep: Episode) => s && update({ ...s, episodes: s.episodes.map((e) => (e.id === ep.id ? ep : e)) });
  const delEp = (ep: Episode) => {
    if (!s) return;
    if (liveVideo(ep.id) && !confirm(`Delete episode ${ep.number} and its video? This happens when you save.`)) return;
    update({ ...s, episodes: s.episodes.filter((e) => e.id !== ep.id).map((e, i) => ({ ...e, number: i + 1 })) });
  };

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {seasons.map((x) => (
          <button key={x.number} onClick={() => setActive(x.number)} className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${x.number === active ? "bg-brand text-white" : "bg-slate-900/5 dark:bg-white/5"}`}>
            Season {x.number} <span className="opacity-70">({x.episodes.length})</span>
          </button>
        ))}
        <Button size="sm" variant="soft" onClick={addSeason} icon={<Plus size={14} />}>Add season</Button>
        {seasons.length > 1 && s && (
          <Button size="sm" variant="ghost" className="ml-auto text-danger" onClick={() => { onChange(seasons.filter((x) => x.number !== active).map((x, i) => ({ ...x, number: i + 1 }))); setActive(1); }}>
            Remove season {active}
          </Button>
        )}
      </div>
      {s && (
        <div className="space-y-3">
          {s.episodes.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No episodes yet. Add the first one.</p>}
          {s.episodes.map((ep) => (
            <div key={ep.id} className="grid gap-3 rounded-xl border border-slate-200/80 bg-white/40 p-3 md:grid-cols-[40px_1fr_260px_auto] dark:border-white/10 dark:bg-white/5">
              <span className="pt-2 text-xl font-bold text-slate-400">{ep.number}</span>
              <div className="space-y-2">
                <div className="grid gap-2 sm:grid-cols-[1fr_100px]">
                  <Input value={ep.title} onChange={(e) => setEp({ ...ep, title: e.target.value })} placeholder="Episode title" aria-label="Episode title" />
                  <Input value={ep.runtime} onChange={(e) => setEp({ ...ep, runtime: e.target.value })} placeholder="45m" aria-label="Runtime" />
                </div>
                <Textarea value={ep.synopsis} onChange={(e) => setEp({ ...ep, synopsis: e.target.value })} placeholder="Episode synopsis" className="!min-h-16" aria-label="Episode synopsis" />
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" value={ep.introStart ?? ""} onChange={(e) => setEp({ ...ep, introStart: e.target.value ? Number(e.target.value) : undefined })} placeholder="Intro start (sec)" aria-label="Intro start" />
                  <Input type="number" value={ep.introEnd ?? ""} onChange={(e) => setEp({ ...ep, introEnd: e.target.value ? Number(e.target.value) : undefined })} placeholder="Intro end (sec)" aria-label="Intro end" />
                </div>
              </div>
              <VideoUploader compact titleId={titleId || undefined} episodeId={ep.id} value={liveVideo(ep.id)} ensureSaved={ensureSaved} />
              <button onClick={() => delEp(ep)} className="self-start rounded-lg p-2 text-danger hover:bg-rose-500/10" title="Delete episode"><Trash2 size={16} /></button>
            </div>
          ))}
          <Button variant="soft" onClick={addEpisode} icon={<Plus size={15} />}>Add episode</Button>
        </div>
      )}
    </Card>
  );
}

function TracksEditor({ t, set, assetId, ensureSaved }: { t: Title; set: (p: Partial<Title>) => void; assetId?: string; ensureSaved: () => Promise<string | null> }) {
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const [lang, setLang] = useState("en");
  const [aLang, setALang] = useState("yo");
  const [ad, setAd] = useState(false);
  const toast = useToast();
  const subs = t.subtitles ?? [];
  const audio = t.audioTracks ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardTitle title="Subtitles & captions" sub="WebVTT or SRT files. Members choose them in the player." />
        <ul className="mb-4 space-y-2">
          {subs.map((s) => (
            <li key={s.id} className="flex items-center gap-3 rounded-xl bg-slate-900/5 px-3 py-2 text-sm dark:bg-white/5">
              <span className="flex-1 font-semibold">{s.label}</span>
              <Badge tone={s.url ? "ok" : "muted"}>{s.url ? "File uploaded" : "Pending file"}</Badge>
              <button
                onClick={() => {
                  void deleteSubtitle(s.url);
                  set({ subtitles: subs.filter((x) => x.id !== s.id) });
                }}
                className="text-danger"
                aria-label={`Remove ${s.label}`}
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
          {subs.length === 0 && <li className="text-sm text-slate-500">No subtitles yet.</li>}
        </ul>
        <div className="flex gap-2">
          <Select value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Subtitle language">
            {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </Select>
          <Button onClick={() => ref.current?.click()} disabled={busy} icon={<Plus size={15} />}>{busy ? "Uploading…" : "Upload file"}</Button>
        </div>
        <input
          ref={ref}
          type="file"
          accept=".vtt,.srt,text/vtt"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            e.target.value = "";
            setBusy(true);
            try {
              const tid = t.id || (await ensureSaved());
              if (!tid) throw new Error("Fill in and save the title details first.");
              const label = LANGS.find((l) => l.code === lang)!.label;
              const url = await uploadSubtitle(tid, lang, label, srtToVtt(await f.text()), assetId);
              const old = subs.find((x) => x.lang === lang);
              if (old) void deleteSubtitle(old.url);
              const next: Subtitle[] = [...subs.filter((x) => x.lang !== lang), { id: uid("sub-"), lang, label, url }];
              set({ subtitles: next });
              toast(`${label} subtitles added. Save the title to publish them.`);
            } catch (x) {
              toast(x instanceof Error ? x.message : "Couldn't upload subtitles.", "bad");
            } finally {
              setBusy(false);
            }
          }}
        />
      </Card>
      <Card>
        <CardTitle title="Audio tracks" sub="Dubs and audio description included in the stream" />
        <ul className="mb-4 space-y-2">
          {audio.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-xl bg-slate-900/5 px-3 py-2 text-sm dark:bg-white/5">
              <span className="flex-1 font-semibold">{a.label}</span>
              {a.description && <Badge tone="info">Audio description</Badge>}
              {audio.length > 1 && (
                <button onClick={() => set({ audioTracks: audio.filter((x) => x.id !== a.id) })} className="text-danger" aria-label={`Remove ${a.label}`}><Trash2 size={15} /></button>
              )}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={aLang} onChange={(e) => setALang(e.target.value)} className="!w-40" aria-label="Audio language">
            {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </Select>
          <label className="flex items-center gap-1.5 text-xs font-semibold"><input type="checkbox" checked={ad} onChange={(e) => setAd(e.target.checked)} className="accent-brand" /> Audio description</label>
          <Button
            variant="soft"
            onClick={() => {
              const l = LANGS.find((x) => x.code === aLang)!;
              set({ audioTracks: [...audio, { id: uid("a"), lang: l.code, label: `${l.label}${ad ? " (Audio Description)" : " (Dub)"}`, description: ad }] });
            }}
            icon={<Plus size={15} />}
          >
            Add track
          </Button>
        </div>
      </Card>
    </div>
  );
}
