"use client";

import { AlertTriangle, CheckCircle2, Film, Loader2, Trash2, UploadCloud, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { duration } from "@/lib/format";
import { uploadVideo, videoStatus, type UploadHandle } from "@/lib/media";
import { removeVideo, setVideoLocal } from "@/lib/store";
import { sb } from "@/lib/supabase";
import type { VideoAsset } from "@/lib/types";
import { Badge, Button, Progress, cx } from "./ui";

const MAX_GB = 20;

/**
 * Uploads a master video straight to Mux, which encodes it for adaptive streaming up to 4K.
 * The title (and episode) must exist in the database first, so `ensureSaved` is called before uploading.
 */
export default function VideoUploader({
  titleId,
  episodeId,
  value,
  ensureSaved,
  compact,
}: {
  titleId?: string;
  episodeId?: string;
  value?: VideoAsset;
  ensureSaved: () => Promise<string | null>;
  compact?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const handle = useRef<UploadHandle | null>(null);
  const [busy, setBusy] = useState<null | { name: string; pct: number }>(null);
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState(false);
  const [removing, setRemoving] = useState(false);

  // While Mux is still working, check every 5 seconds and pull the result into the dashboard
  const pending = value && (value.status === "uploading" || value.status === "processing");
  useEffect(() => {
    if (!pending || !titleId) return;
    let stop = false;
    const tick = async () => {
      try {
        if (value?.upload_id) await videoStatus(value.upload_id);
        const q = episodeId ? sb().from("episodes").select("video").eq("id", episodeId) : sb().from("titles").select("video").eq("id", titleId);
        const { data } = await q.maybeSingle();
        const v = (data?.video ?? undefined) as VideoAsset | undefined;
        if (!stop && v && (v.status !== value?.status || v.asset_id !== value?.asset_id)) setVideoLocal(titleId, episodeId, v);
      } catch {
        /* try again next tick */
      }
    };
    const id = setInterval(tick, 5000);
    void tick();
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [pending, titleId, episodeId, value?.upload_id, value?.status, value?.asset_id]);

  // Warn before leaving mid-upload
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  const start = async (file?: File) => {
    if (!file) return;
    setErr("");
    if (!file.type.startsWith("video/") && !/\.(mp4|mov|mkv|webm|m4v|mxf)$/i.test(file.name)) return setErr("Choose a video file (MP4, MOV, MKV or WebM).");
    if (file.size > MAX_GB * 1024 ** 3) return setErr(`Files over ${MAX_GB} GB are too large. Export a smaller master (H.264 or ProRes Proxy).`);
    setBusy({ name: file.name, pct: 0 });
    const tid = await ensureSaved();
    if (!tid) {
      setBusy(null);
      return setErr("Fill in and save the title details first, then upload the video.");
    }
    try {
      if (value) await removeVideo(tid, episodeId, value);
      handle.current = uploadVideo(file, { titleId: tid, episodeId, onProgress: (p) => setBusy({ name: file.name, pct: p }) });
      const upload_id = await handle.current.promise;
      setVideoLocal(tid, episodeId, { provider: "mux", upload_id, status: "processing", fileName: file.name, sizeMB: Math.round((file.size / 1024 ** 2) * 10) / 10, updated_at: new Date().toISOString() });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed. Try again.");
    } finally {
      handle.current = null;
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!titleId || !value) return;
    if (!confirm("Remove this video? Members won't be able to play it until a new one is uploaded.")) return;
    setRemoving(true);
    await removeVideo(titleId, episodeId, value);
    setRemoving(false);
  };

  if (busy) {
    return (
      <div className={cx("rounded-xl border border-slate-200/80 bg-white/50 dark:border-white/10 dark:bg-white/5", compact ? "p-3" : "p-4")}>
        <div className="mb-2 flex items-center gap-2">
          <Loader2 size={15} className="animate-spin text-brand" />
          <p className="min-w-0 flex-1 truncate text-sm font-semibold">Uploading {busy.name}</p>
          <span className="text-xs text-slate-500">{Math.round(busy.pct * 100)}%</span>
          <button onClick={() => handle.current?.cancel()} className="rounded p-1 text-slate-500 hover:bg-slate-900/5" title="Cancel upload"><X size={14} /></button>
        </div>
        <Progress value={busy.pct} />
        {!compact && <p className="mt-2 text-xs text-slate-500">Keep this tab open until the upload finishes. Encoding then continues on Mux even if you leave.</p>}
      </div>
    );
  }

  if (value) {
    const ready = value.status === "ready";
    const failed = value.status === "error";
    return (
      <div className={cx("rounded-xl border border-slate-200/80 bg-white/50 dark:border-white/10 dark:bg-white/5", compact ? "p-3" : "p-4")}>
        <div className="flex items-start gap-3">
          <span className="rounded-lg bg-brand/10 p-2 text-brand"><Film size={18} /></span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{value.fileName ?? (ready ? "Video" : "New video")}</p>
            <p className="text-xs text-slate-500">
              {ready
                ? [value.height ? (value.height >= 2160 ? "4K (2160p)" : `${value.height}p`) : "", duration(value.duration), value.policy === "signed" ? "protected stream" : ""].filter(Boolean).join(" · ")
                : failed
                  ? "Mux couldn't read this file. Export it again as MP4 (H.264) and re-upload."
                  : "Encoding for streaming. Usually a few minutes per hour of video."}
            </p>
          </div>
          {ready ? <Badge tone="ok"><CheckCircle2 size={12} /> Ready</Badge> : failed ? <Badge tone="bad"><AlertTriangle size={12} /> Failed</Badge> : <Badge tone="warn"><Loader2 size={12} className="animate-spin" /> Processing</Badge>}
          <button onClick={remove} disabled={removing} className="rounded-lg p-1.5 text-danger hover:bg-rose-500/10 disabled:opacity-50" title="Remove video">
            {removing ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
          </button>
        </div>
        {!compact && ready && (
          <p className="mt-3 text-xs text-slate-500">
            Streams with adaptive quality. Each member gets the best their plan and network allow (Mobile 480p, Basic 720p, Standard 1080p, Premium up to 4K). English captions are generated automatically.
          </p>
        )}
        {!compact && <Button size="sm" variant="ghost" className="mt-2" onClick={() => input.current?.click()} icon={<UploadCloud size={14} />}>Replace video</Button>}
        <input ref={input} type="file" accept="video/*,.mkv,.mxf" hidden onChange={(e) => start(e.target.files?.[0])} />
        {err && <p className="mt-2 text-xs text-danger">{err}</p>}
      </div>
    );
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          start(e.dataTransfer.files?.[0]);
        }}
        onClick={() => input.current?.click()}
        className={cx(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed text-center transition",
          compact ? "p-3" : "p-8",
          drag ? "border-brand bg-brand/5" : "border-slate-300 hover:border-brand dark:border-white/15",
        )}
      >
        <input ref={input} type="file" accept="video/*,.mkv,.mxf" hidden onChange={(e) => start(e.target.files?.[0])} />
        <UploadCloud className="text-brand" size={compact ? 18 : 32} />
        <p className={cx("font-semibold", compact ? "mt-1 text-xs" : "mt-2 text-sm")}>{compact ? "Upload episode video" : "Drop a master video or click to browse"}</p>
        {!compact && <p className="mt-1 text-xs text-slate-500">MP4, MOV, MKV or WebM up to {MAX_GB} GB · 4K (2160p) sources supported</p>}
      </div>
      {err && <p className="mt-2 text-xs text-danger">{err}</p>}
    </div>
  );
}
