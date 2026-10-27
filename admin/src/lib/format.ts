import type { Rendition, RenditionLabel, VideoAsset } from "./types";

export const naira = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;
export const nairaShort = (n: number) =>
  n >= 1e9 ? `₦${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `₦${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `₦${(n / 1e3).toFixed(0)}K` : naira(n);
export const num = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : `${Math.round(n)}`);
export const pct = (n: number, d = 1) => `${n.toFixed(d)}%`;
export const date = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "-");
export const dateTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "-";
export const ago = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
export const img = (id: string, w = 400, h?: number) =>
  id.startsWith("http") || id.startsWith("data:") ? id : `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}${h ? `&h=${h}` : ""}&q=70`;

/* ---------- Encoding ladder (adaptive streaming renditions) ---------- */
const LADDER: { label: RenditionLabel; height: number; bitrateKbps: number }[] = [
  { label: "480p", height: 480, bitrateKbps: 1200 },
  { label: "720p", height: 720, bitrateKbps: 3000 },
  { label: "1080p", height: 1080, bitrateKbps: 5800 },
  { label: "1440p", height: 1440, bitrateKbps: 9500 },
  { label: "2160p", height: 2160, bitrateKbps: 16000 },
];

/** Renditions to produce for a source: never upscale. Processing time scales with resolution. */
export function ladderFor(sourceHeight: number): Rendition[] {
  const h = sourceHeight || 1080;
  return LADDER.filter((l) => l.height <= Math.max(h, 480)).map((l) => ({ ...l, durationSec: Math.round(8 + l.height / 90) }));
}

/** Progress of each rendition based on time since processing started (no background workers needed). */
export function renditionProgress(v: VideoAsset, now = Date.now()) {
  const elapsed = (now - new Date(v.processingStartedAt).getTime()) / 1000;
  let offset = 0;
  return v.renditions.map((r) => {
    const p = Math.max(0, Math.min(1, (elapsed - offset * 0.35) / r.durationSec));
    offset += r.durationSec;
    return { ...r, progress: p, done: p >= 1 };
  });
}

export function videoState(v?: VideoAsset, now = Date.now()) {
  if (!v) return { label: "No video", tone: "muted" as const, progress: 0 };
  if (v.source === "url") return { label: "Ready (external stream)", tone: "ok" as const, progress: 1 };
  const r = renditionProgress(v, now);
  const done = r.filter((x) => x.done).length;
  const progress = r.reduce((a, x) => a + x.progress, 0) / (r.length || 1);
  if (done === r.length) return { label: `Ready · ${r[r.length - 1]?.label ?? ""}`, tone: "ok" as const, progress: 1 };
  return { label: `Processing ${Math.round(progress * 100)}%`, tone: "warn" as const, progress };
}

export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

export function download(name: string, text: string, type = "text/csv") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const COLORS = ["#0d9b5f", "#3b82f6", "#f5a524", "#a855f7", "#e5484d", "#14b8a6"];
export const chartTip = { contentStyle: { borderRadius: 12, border: "none", boxShadow: "0 8px 30px rgba(0,0,0,.12)", fontSize: 12 } };
export const GENRES = ["Nollywood", "Drama", "Comedy", "Romance", "Thriller", "Crime", "Action", "Adventure", "Epic", "Horror", "Mystery", "Suspense", "Family", "Kids", "Documentary", "Business", "History", "Sports", "Education", "Nature", "Holiday"];
export const LANGS = [
  { code: "en", label: "English" },
  { code: "yo", label: "Yorùbá" },
  { code: "ha", label: "Hausa" },
  { code: "ig", label: "Igbo" },
  { code: "pcm", label: "Pidgin" },
  { code: "fr", label: "French" },
];
