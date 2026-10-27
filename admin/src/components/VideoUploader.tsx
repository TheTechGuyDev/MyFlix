"use client";

import { CheckCircle2, Film, Link2, Loader2, Trash2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { deleteMedia, probeVideo, putMedia } from "@/lib/media";
import { ladderFor, renditionProgress } from "@/lib/format";
import { uid } from "@/lib/store";
import type { VideoAsset } from "@/lib/types";
import { Badge, Button, Input, Progress, cx, useNow } from "./ui";

const MAX_GB = 8;

/** Upload a master file (stored in the browser) or attach an existing HLS/MP4 URL. Shows the encoding ladder. */
export default function VideoUploader({ value, onChange, compact }: { value?: VideoAsset; onChange: (v?: VideoAsset) => void; compact?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"upload" | "url">(value?.source ?? "upload");
  const [url, setUrl] = useState(value?.url ?? "");
  const [busy, setBusy] = useState<null | { name: string; pct: number }>(null);
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState(false);
  const now = useNow(1000);

  const handle = async (file?: File) => {
    if (!file) return;
    setErr("");
    if (!file.type.startsWith("video/") && !/\.(mp4|mov|mkv|webm|m4v)$/i.test(file.name)) return setErr("Choose a video file (MP4, MOV, MKV or WebM).");
    if (file.size > MAX_GB * 1024 ** 3) return setErr(`Files over ${MAX_GB} GB must be uploaded through the backend uploader.`);
    setBusy({ name: file.name, pct: 5 });
    const meta = await probeVideo(file);
    setBusy({ name: file.name, pct: 35 });
    const id = uid("vid-");
    try {
      // Simulated chunk progress while the browser writes the file
      const ticker = setInterval(() => setBusy((b) => (b ? { ...b, pct: Math.min(95, b.pct + 6) } : b)), 250);
      await putMedia(id, file);
      clearInterval(ticker);
    } catch {
      setBusy(null);
      return setErr("Your browser ran out of storage for this file. Free up space or attach a stream URL instead.");
    }
    if (value?.mediaId) deleteMedia(value.mediaId);
    const now = new Date().toISOString();
    onChange({
      source: "upload",
      mediaId: id,
      fileName: file.name,
      sizeMB: Math.round((file.size / 1024 ** 2) * 10) / 10,
      width: meta.width,
      height: meta.height,
      durationSec: Math.round(meta.duration),
      uploadedAt: now,
      processingStartedAt: now,
      renditions: ladderFor(meta.height),
    });
    setBusy(null);
  };

  const attachUrl = () => {
    setErr("");
    if (!/^https:\/\/.+\.(m3u8|mp4)(\?.*)?$/i.test(url.trim())) return setErr("Enter an https link ending in .m3u8 (HLS) or .mp4.");
    const now = new Date().toISOString();
    onChange({ source: "url", url: url.trim(), uploadedAt: now, processingStartedAt: now, renditions: [] });
  };

  if (value) {
    const r = value.source === "upload" ? renditionProgress(value, now) : [];
    const ready = r.every((x) => x.done);
    return (
      <div className={cx("rounded-xl border border-slate-200/80 bg-white/50 dark:border-white/10 dark:bg-white/5", compact ? "p-3" : "p-4")}>
        <div className="flex items-start gap-3">
          <span className="rounded-lg bg-brand/10 p-2 text-brand">{value.source === "url" ? <Link2 size={18} /> : <Film size={18} />}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{value.source === "url" ? value.url : value.fileName}</p>
            <p className="text-xs text-slate-500">
              {value.source === "url"
                ? "External stream · adaptive bitrate handled by the stream"
                : `${value.width}×${value.height} · ${Math.floor((value.durationSec ?? 0) / 60)}m ${(value.durationSec ?? 0) % 60}s · ${value.sizeMB} MB`}
            </p>
          </div>
          {value.source === "upload" && (ready ? <Badge tone="ok"><CheckCircle2 size={12} /> Ready</Badge> : <Badge tone="warn"><Loader2 size={12} className="animate-spin" /> Encoding</Badge>)}
          <button
            onClick={() => {
              if (value.mediaId) deleteMedia(value.mediaId);
              onChange(undefined);
            }}
            className="rounded-lg p-1.5 text-danger hover:bg-rose-500/10"
            title="Remove video"
          >
            <Trash2 size={15} />
          </button>
        </div>
        {r.length > 0 && !compact && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {r.map((x) => (
              <div key={x.label} className="rounded-lg bg-slate-900/5 p-2.5 dark:bg-white/5">
                <div className="mb-1.5 flex justify-between text-xs">
                  <span className="font-semibold">{x.label === "2160p" ? "4K (2160p)" : x.label}</span>
                  <span className="text-slate-500">{x.done ? `${(x.bitrateKbps / 1000).toFixed(1)} Mbps` : `${Math.round(x.progress * 100)}%`}</span>
                </div>
                <Progress value={x.progress} tone={x.done ? "brand" : "warn"} />
              </div>
            ))}
            <p className="text-xs text-slate-500 sm:col-span-2">
              Encoded to HLS with a {r.length}-step adaptive ladder. Members get the best quality their plan and network allow. Sources are never upscaled.
            </p>
          </div>
        )}
        {r.length > 0 && compact && !ready && <div className="mt-2"><Progress value={r.reduce((a, x) => a + x.progress, 0) / r.length} tone="warn" /></div>}
      </div>
    );
  }

  return (
    <div>
      {!compact && (
        <div className="mb-3 flex gap-2">
          <Button size="sm" variant={mode === "upload" ? "soft" : "ghost"} onClick={() => setMode("upload")} icon={<UploadCloud size={14} />}>Upload file</Button>
          <Button size="sm" variant={mode === "url" ? "soft" : "ghost"} onClick={() => setMode("url")} icon={<Link2 size={14} />}>Stream URL</Button>
        </div>
      )}
      {mode === "upload" ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files?.[0]); }}
          onClick={() => !busy && input.current?.click()}
          className={cx(
            "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed text-center transition",
            compact ? "p-3" : "p-8",
            drag ? "border-brand bg-brand/5" : "border-slate-300 hover:border-brand dark:border-white/15",
          )}
        >
          <input ref={input} type="file" accept="video/*,.mkv" hidden onChange={(e) => handle(e.target.files?.[0])} />
          {busy ? (
            <div className="w-full max-w-sm">
              <p className="mb-2 truncate text-sm font-semibold">Uploading {busy.name}</p>
              <Progress value={busy.pct / 100} />
            </div>
          ) : (
            <>
              <UploadCloud className="text-brand" size={compact ? 18 : 32} />
              <p className={cx("font-semibold", compact ? "mt-1 text-xs" : "mt-2 text-sm")}>{compact ? "Upload episode video" : "Drop a master video or click to browse"}</p>
              {!compact && <p className="mt-1 text-xs text-slate-500">MP4, MOV, MKV or WebM up to {MAX_GB} GB · 4K (2160p) sources supported</p>}
            </>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://cdn.example.com/title/master.m3u8" />
          <Button onClick={attachUrl}>Attach</Button>
        </div>
      )}
      {err && <p className="mt-2 text-xs text-danger">{err}</p>}
    </div>
  );
}
