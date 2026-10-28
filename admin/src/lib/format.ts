import type { VideoAsset } from "./types";

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

/** Where a Mux video is in its journey: uploading, processing, ready or failed. */
export function videoState(v?: VideoAsset) {
  if (!v) return { label: "No video", tone: "muted" as const, progress: 0 };
  if (v.status === "ready") return { label: `Ready${v.height ? ` · ${v.height >= 2160 ? "4K" : `${v.height}p`}` : ""}`, tone: "ok" as const, progress: 1 };
  if (v.status === "error") return { label: "Failed, upload again", tone: "bad" as const, progress: 0 };
  if (v.status === "processing") return { label: "Processing", tone: "warn" as const, progress: 0.6 };
  return { label: "Uploading", tone: "warn" as const, progress: 0.2 };
}

export function duration(sec?: number) {
  if (!sec) return "";
  const s = Math.round(sec);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
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
