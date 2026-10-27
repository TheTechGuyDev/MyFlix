"use client";

import { HardDrive, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Card, CardTitle, Empty, PageHeader, Progress, Stat, Table, Td, useNow } from "@/components/ui";
import { dateTime, img, renditionProgress } from "@/lib/format";
import { storageEstimate } from "@/lib/media";
import { useDb } from "@/lib/store";
import type { Title, VideoAsset } from "@/lib/types";

type Job = { title: Title; label: string; v: VideoAsset };

export default function UploadsPage() {
  const titles = useDb((d) => d.titles);
  const now = useNow(1000);
  const [store, setStore] = useState({ used: 0, quota: 0 });
  useEffect(() => {
    storageEstimate().then(setStore);
  }, [titles]);

  const jobs: Job[] = [];
  for (const t of titles) {
    if (t.video) jobs.push({ title: t, label: "Feature", v: t.video });
    t.seasonsData?.forEach((s) => s.episodes.forEach((e) => e.video && jobs.push({ title: t, label: `S${s.number}:E${e.number} ${e.title}`, v: e.video })));
  }
  jobs.sort((a, b) => b.v.uploadedAt.localeCompare(a.v.uploadedAt));
  const withProg = jobs.map((j) => {
    const r = j.v.source === "upload" ? renditionProgress(j.v, now) : [];
    const p = r.length ? r.reduce((a, x) => a + x.progress, 0) / r.length : 1;
    return { ...j, r, p };
  });
  const processing = withProg.filter((j) => j.p < 1);
  const totalMB = jobs.reduce((a, j) => a + (j.v.sizeMB ?? 0), 0);
  const fourK = jobs.filter((j) => (j.v.height ?? 0) >= 2160).length;

  return (
    <div className="space-y-5">
      <PageHeader title="Uploads & Encoding" sub="Every master file, its adaptive renditions and processing status." actions={<Link href="/content/edit" className="inline-flex h-10 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-hover">Upload new title</Link>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Videos" value={String(jobs.length)} />
        <Stat label="Processing now" value={String(processing.length)} />
        <Stat label="4K masters" value={String(fourK)} />
        <Stat label="Master storage" value={`${(totalMB / 1024).toFixed(2)} GB`} hint={store.quota ? `Browser quota ${(store.quota / 1024 ** 3).toFixed(1)} GB` : undefined} icon={<HardDrive size={20} />} />
      </div>

      {processing.length > 0 && (
        <Card>
          <CardTitle title="Encoding queue" sub="Renditions are produced lowest first so titles become watchable quickly" />
          <div className="space-y-4">
            {processing.map((j) => (
              <div key={j.v.mediaId}>
                <div className="mb-1.5 flex items-center gap-2 text-sm">
                  <Loader2 size={14} className="animate-spin text-warn" />
                  <span className="font-semibold">{j.title.title}</span>
                  <span className="text-slate-500">{j.label}</span>
                  <span className="ml-auto text-xs font-semibold">{Math.round(j.p * 100)}%</span>
                </div>
                <Progress value={j.p} tone="warn" />
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {j.r.map((x) => <Badge key={x.label} tone={x.done ? "ok" : x.progress > 0 ? "warn" : "muted"}>{x.label} {x.done ? "✓" : `${Math.round(x.progress * 100)}%`}</Badge>)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card pad={false}>
        {jobs.length === 0 ? (
          <Empty title="No uploads yet" sub="Upload a master video from any title's Video tab." action={<Link href="/content" className="text-sm font-semibold text-brand">Open Content Library</Link>} />
        ) : (
          <Table head={["Title", "Asset", "Source", "Resolution", "Renditions", "Uploaded", "Status"]} minW={900}>
            {withProg.map((j, i) => (
              <tr key={(j.v.mediaId ?? j.v.url ?? "") + i} className="hover:bg-white/40 dark:hover:bg-white/5">
                <Td>
                  <Link href={`/content/edit?id=${j.title.id}`} className="flex items-center gap-2 font-semibold">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img(j.title.image, 60, 90)} alt="" className="h-10 w-7 rounded object-cover" />
                    {j.title.title}
                  </Link>
                </Td>
                <Td className="text-xs">{j.label}</Td>
                <Td className="max-w-[200px] truncate text-xs text-slate-500">{j.v.source === "url" ? j.v.url : `${j.v.fileName} · ${j.v.sizeMB} MB`}</Td>
                <Td>{j.v.height ? `${j.v.width}×${j.v.height}` : "Adaptive"}</Td>
                <Td className="text-xs">{j.r.length ? j.r.map((x) => x.label).join(" · ") : "From stream"}</Td>
                <Td className="text-xs text-slate-500">{dateTime(j.v.uploadedAt)}</Td>
                <Td>{j.p >= 1 ? <Badge tone="ok">Ready</Badge> : <Badge tone="warn">{Math.round(j.p * 100)}%</Badge>}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
