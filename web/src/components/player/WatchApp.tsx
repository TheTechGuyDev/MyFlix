"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { allowedFor, catalog, episodesFor, type VideoAsset } from "@/lib/catalog";
import { getAccount, getActiveProfileId, settingsOf, type Account, type Profile } from "@/lib/mock-auth";
import { readProgress } from "@/lib/library";
import { getMediaUrl } from "@/lib/media";
import { siteSettings } from "@/lib/site-settings";
import { sourcesFor } from "@/lib/streams";
import Player from "./Player";

type Resolved = { sources: string[]; subs: { label: string; src: string; lang: string }[] };

export default function WatchApp() {
  const router = useRouter();
  const params = useSearchParams();
  const [ctx, setCtx] = useState<{ account: Account; profile: Profile } | null>(null);
  const [media, setMedia] = useState<Resolved | null>(null);

  const id = params.get("id") ?? "";
  const index = catalog.findIndex((t) => t.id === id);
  const title = index >= 0 ? catalog[index] : null;

  useEffect(() => {
    const account = getAccount();
    if (!account) return router.replace("/login");
    if (account.suspended) return router.replace("/login?suspended=1");
    if (!account.payment) return router.replace("/signup/payment");
    if (siteSettings().maintenance) return router.replace("/browse");
    const profile = account.profiles.find((p) => p.id === getActiveProfileId());
    if (!profile) return router.replace("/profiles");
    if (!title || title.comingSoon || (profile.kids && !title.kids) || !allowedFor(title, settingsOf(profile).maturity)) return router.replace("/browse");
    setCtx({ account, profile });
  }, [router, title]);

  const saved = ctx && title ? readProgress(ctx.profile.id, title.id) : undefined;
  const season = Number(params.get("s")) || saved?.season || 1;
  const episode = Number(params.get("e")) || saved?.episode || 1;
  const ep = title?.type === "series" ? episodesFor(title, season).find((e) => e.number === episode) : undefined;
  const asset: VideoAsset | undefined = title?.type === "series" ? ep?.video : title?.video;

  // Resolve uploaded video + subtitle files (stored by the admin dashboard in this browser)
  useEffect(() => {
    if (!ctx || !title) return;
    let cancelled = false;
    (async () => {
      const demo = sourcesFor(index);
      const first: string[] = [];
      if (asset?.source === "url" && asset.url) first.push(asset.url);
      if (asset?.source === "upload" && asset.mediaId) {
        const u = await getMediaUrl(asset.mediaId);
        if (u) first.push(u);
      }
      const subs: Resolved["subs"] = [];
      for (const s of title.subtitles ?? []) {
        const src = s.mediaId ? await getMediaUrl(s.mediaId) : s.url ?? null;
        if (src) subs.push({ label: s.label, src, lang: s.lang });
      }
      if (!cancelled) setMedia({ sources: [...first, ...demo], subs });
    })();
    return () => {
      cancelled = true;
    };
  }, [ctx, title, index, asset?.source, asset?.url, asset?.mediaId]);

  if (!ctx || !title || !media) return <div className="fixed inset-0 bg-black" />;

  const introSrc = ep ?? title;
  const intro =
    introSrc.introStart !== undefined && introSrc.introEnd !== undefined
      ? { start: introSrc.introStart, end: introSrc.introEnd }
      : title.type === "series"
        ? { start: 5, end: 35 }
        : undefined;

  return (
    <Player
      key={`${title.id}-${season}-${episode}`}
      title={title}
      sources={media.sources}
      extraSubs={media.subs}
      intro={intro}
      season={season}
      episode={episode}
      profileId={ctx.profile.id}
      planId={ctx.account.planId ?? "standard"}
      prefs={settingsOf(ctx.profile)}
    />
  );
}
