"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { allowedFor, catalog } from "@/lib/catalog";
import { getAccount, getActiveProfileId, settingsOf, type Account, type Profile } from "@/lib/mock-auth";
import { readProgress } from "@/lib/library";
import Player from "./Player";

export default function WatchApp() {
  const router = useRouter();
  const params = useSearchParams();
  const [ctx, setCtx] = useState<{ account: Account; profile: Profile } | null>(null);

  const id = params.get("id") ?? "";
  const index = catalog.findIndex((t) => t.id === id);
  const title = index >= 0 ? catalog[index] : null;

  useEffect(() => {
    const account = getAccount();
    if (!account) return router.replace("/login");
    if (!account.payment) return router.replace("/signup/payment");
    const profile = account.profiles.find((p) => p.id === getActiveProfileId());
    if (!profile) return router.replace("/profiles");
    if (!title || title.comingSoon || (profile.kids && !title.kids) || !allowedFor(title, settingsOf(profile).maturity)) return router.replace("/browse");
    setCtx({ account, profile });
  }, [router, title]);

  if (!ctx || !title) return <div className="fixed inset-0 bg-black" />;

  // Default to the saved episode for series when none is given
  const saved = readProgress(ctx.profile.id, title.id);
  const season = Number(params.get("s")) || saved?.season || 1;
  const episode = Number(params.get("e")) || saved?.episode || 1;

  return (
    <Player
      key={`${title.id}-${season}-${episode}`}
      title={title}
      titleIndex={index}
      season={season}
      episode={episode}
      profileId={ctx.profile.id}
      planId={ctx.account.planId ?? "standard"}
      prefs={settingsOf(ctx.profile)}
    />
  );
}
