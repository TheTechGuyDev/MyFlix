"use client";

import { Cloud, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, CardTitle, Empty, PageHeader, Progress, Stat, Table, Td } from "@/components/ui";
import { dateTime, duration, img, videoState } from "@/lib/format";
import { videoCount } from "@/lib/media";
import { loadAll, useDb } from "@/lib/store";
import type { Title, VideoAsset } from "@/lib/types";

type Job = { title: Title; label: string; v: VideoAsset };
const FREE_ASSETS = 10;

export default function UploadsPage() {
  const titles = useDb((d) => d.titles);
  const [count, setCount] = useState<number | null>(null);
  const [countErr, setCountErr] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const checkMux = useCallback(() => {
    videoCount()
      .then((n) => {
        setCount(n);
        setCountErr("");
      })
      .catch((e: Error) => setCountErr(e.message));
  }, []);
  useEffect(checkMux, [checkMux]);

  const jobs: Job[] = [];
  for (const t of titles) {
    if (t.video) jobs.push({ title: t, label: "Feature", v: t.video });
    t.seasonsData?.forEach((s) => s.episodes.forEach((e) => e.video && jobs.push({ title: t, label: `S${s.number}:E${e.number} ${e.title}`, v: e.video })));
  }
  jobs.sort((a, b) => (b.v.updated_at ?? "").localeCompare(a.v.updated_at ?? ""));
  const processing = jobs.filter((j) => j.v.status === "uploading" || j.v.status === "processing");
  const failed = jobs.filter((j) => j.v.status === "error").length;
  const fourK = jobs.filter((j) => (j.v.height ?? 0) >= 2160).length;
  const hours = jobs.reduce((a, j) => a + (j.v.duration ?? 0), 0) / 3600;

  // While anything is encoding, refresh every 10 seconds
  useEffect(() => {
    if (!processing.length) return;
    const id = setInterval(() => void loadAll(), 10000);
    return () => clearInterval(id);
  }, [processing.length]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Uploads & Encoding"
        sub="Every video on Mux, its quality and processing status."
        actions={
          <>
            <Button variant="ghost" disabled={refreshing} onClick={async () => { setRefreshing(true); await loadAll(); checkMux(); setRefreshing(false); }} icon={<RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />}>Refresh</Button>
            <Link href="/content/edit" className="inline-flex h-10 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-hover">Upload new title</Link>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Videos" value={String(jobs.length)} hint={failed ? `${failed} failed` : undefined} />
        <Stat label="Processing now" value={String(processing.length)} />
        <Stat label="4K masters" value={String(fourK)} hint={`${hours.toFixed(1)} hours of video`} />
        <Stat
          label="Mux storage"
          value={count == null ? (countErr ? "Not connected" : "…") : `${count} / ${FREE_ASSETS}`}
          hint={countErr ? "Add the Mux keys to start uploading" : "Videos on the free plan"}
          icon={<Cloud size={20} />}
        />
      </div>

      {count != null && count >= FREE_ASSETS - 2 && (
        <Card>
          <p className="text-sm">
            <strong>{count >= FREE_ASSETS ? "Mux free plan is full." : "Mux free plan is almost full."}</strong> The free plan holds {FREE_ASSETS} videos. Delete videos you no longer need, or move to a paid Mux plan (pay as you go) to keep uploading.
          </p>
        </Card>
      )}

      {processing.length > 0 && (
        <Card>
          <CardTitle title="Encoding queue" sub="Mux encodes each upload into adaptive quality levels. Most finish in a few minutes." />
          <div className="space-y-4">
            {processing.map((j, i) => (
              <div key={(j.v.upload_id ?? j.v.asset_id ?? "") + i}>
                <div className="mb-1.5 flex items-center gap-2 text-sm">
                  <Loader2 size={14} className="animate-spin text-warn" />
                  <span className="font-semibold">{j.title.title}</span>
                  <span className="text-slate-500">{j.label}</span>
                  <span className="ml-auto text-xs font-semibold">{j.v.status === "uploading" ? "Receiving file" : "Encoding"}</span>
                </div>
                <Progress value={videoState(j.v).progress} tone="warn" />
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card pad={false}>
        {jobs.length === 0 ? (
          <Empty title="No uploads yet" sub="Upload a master video from any title's Video tab." action={<Link href="/content" className="text-sm font-semibold text-brand">Open Content Library</Link>} />
        ) : (
          <Table head={["Title", "Asset", "File", "Quality", "Length", "Updated", "Status"]} minW={900}>
            {jobs.map((j, i) => {
              const s = videoState(j.v);
              return (
                <tr key={(j.v.asset_id ?? j.v.upload_id ?? "") + i} className="hover:bg-white/40 dark:hover:bg-white/5">
                  <Td>
                    <Link href={`/content/edit?id=${j.title.id}`} className="flex items-center gap-2 font-semibold">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img(j.title.image, 60, 90)} alt="" className="h-10 w-7 rounded object-cover" />
                      {j.title.title}
                    </Link>
                  </Td>
                  <Td className="text-xs">{j.label}</Td>
                  <Td className="max-w-[200px] truncate text-xs text-slate-500">{j.v.fileName ? `${j.v.fileName}${j.v.sizeMB ? ` · ${j.v.sizeMB} MB` : ""}` : j.v.asset_id ?? "-"}</Td>
                  <Td>{j.v.height ? (j.v.height >= 2160 ? "4K" : `${j.v.height}p`) : "-"}</Td>
                  <Td className="text-xs">{duration(j.v.duration) || "-"}</Td>
                  <Td className="text-xs text-slate-500">{dateTime(j.v.updated_at)}</Td>
                  <Td><Badge tone={s.tone}>{s.label}</Badge></Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </div>
  );
}
