"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { allowedFor, catalog } from "@/lib/catalog";
import { getAccount, getActiveProfileId, settingsOf, type Account, type Profile } from "@/lib/mock-auth";
import { readProgress } from "@/lib/library";
import { resolveMedia, type ResolvedMedia } from "@/lib/resolve-media";
import { siteSettings } from "@/lib/site-settings";
import Player from "./Player";

export default function WatchApp() {
  const router = useRouter();
  const params = useSearchParams();
  const [ctx, setCtx] = useState<{ account: Account; profile: Profile } | null>(null);
  const [media, setMedia] = useState<ResolvedMedia | null>(null);

  const id = params.get("id") ?? "";
  const title = catalog.find((t) => t.id === id) ?? null;

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

  useEffect(() => {
    if (!ctx || !title) return;
    let cancelled = false;
    resolveMedia(title, season, episode).then((m) => !cancelled && setMedia(m));
    return () => {
      cancelled = true;
    };
  }, [ctx, title, season, episode]);

  if (!ctx || !title || !media) return <div className="fixed inset-0 bg-black" />;

  return (
    <Player
      key={`${title.id}-${season}-${episode}`}
      title={title}
      sources={media.sources}
      extraSubs={media.subs}
      intro={media.intro}
      season={season}
      episode={episode}
      profileId={ctx.profile.id}
      planId={ctx.account.planId ?? "standard"}
      prefs={settingsOf(ctx.profile)}
      startAt={params.get("t") ? Number(params.get("t")) : undefined}
      email={ctx.account.email}
      profileName={ctx.profile.name}
    />
  );
}
