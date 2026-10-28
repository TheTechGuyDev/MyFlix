"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { allowedFor, catalog } from "@/lib/catalog";
import { getAccount, getActiveProfileId, settingsOf, type Account, type Profile } from "@/lib/account";
import { loadLibrary, readProgress } from "@/lib/library";
import { deviceName, stopStream, type LiveStream } from "@/lib/live";
import { resolveMedia, type ResolvedMedia } from "@/lib/resolve-media";
import { siteSettings } from "@/lib/site-settings";
import Player from "./Player";

const newStreamId = () => `st-${crypto.randomUUID()}`;

export default function WatchApp() {
  const router = useRouter();
  const params = useSearchParams();
  const [ctx, setCtx] = useState<{ account: Account; profile: Profile } | null>(null);
  const [media, setMedia] = useState<ResolvedMedia | null>(null);
  const [blocked, setBlocked] = useState<{ others: LiveStream[]; limit: number } | null>(null);
  const [error, setError] = useState("");
  const [streamId] = useState(newStreamId);
  const [attempt, setAttempt] = useState(0);
  const [libReady, setLibReady] = useState(false);

  const id = params.get("id") ?? "";
  const title = catalog.find((t) => t.id === id) ?? null;

  useEffect(() => {
    const account = getAccount();
    if (!account) return router.replace("/login");
    if (account.suspended) return router.replace("/login?suspended=1");
    if (!account.hasAccess) return router.replace("/account/payment");
    if (siteSettings().maintenance) return router.replace("/browse");
    const profile = account.profiles.find((p) => p.id === getActiveProfileId());
    if (!profile) return router.replace("/profiles");
    if (!title || title.comingSoon || (profile.kids && !title.kids) || !allowedFor(title, settingsOf(profile).maturity)) return router.replace("/browse");
    setCtx({ account, profile });
    loadLibrary(profile.id).finally(() => setLibReady(true));
  }, [router, title]);

  const saved = ctx && title && libReady ? readProgress(ctx.profile.id, title.id) : undefined;
  const season = Number(params.get("s")) || saved?.season || title?.seasonsData?.[0]?.number || 1;
  const episode = Number(params.get("e")) || saved?.episode || 1;

  useEffect(() => {
    if (!ctx || !title || !libReady) return;
    let cancelled = false;
    setError("");
    resolveMedia(title, season, episode, { streamId, profileId: ctx.profile.id, device: deviceName() }).then((r) => {
      if (cancelled) return;
      if (r.ok) return setMedia(r.media);
      const c = r.claim;
      if (c && !c.ok) {
        if (c.reason === "screens") return setBlocked({ others: c.others ?? [], limit: c.limit ?? 1 });
        if (c.reason === "membership") return router.replace("/account/payment");
        if (c.reason === "suspended") return router.replace("/login?suspended=1");
        if (c.reason === "profile") return router.replace("/profiles");
      }
      setError(r.error ?? "We couldn't start this title.");
    });
    return () => {
      cancelled = true;
    };
  }, [ctx, title, season, episode, streamId, router, attempt, libReady]);

  if (blocked) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-black px-6 text-center text-white">
        <p className="text-2xl font-bold">Too many people are using your account right now</p>
        <p className="max-w-md text-white/70">Your plan allows {blocked.limit} screen{blocked.limit > 1 ? "s" : ""} at a time. Stop one of these streams to watch here, or upgrade your plan.</p>
        <ul className="w-full max-w-md divide-y divide-white/10 rounded-md bg-white/5 text-left">
          {blocked.others.map((o) => (
            <li key={o.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex-1">
                <span className="block font-semibold">{o.profile} on {o.device}</span>
                <span className="block text-sm text-white/60">Watching {o.title}</span>
              </span>
              <button onClick={async () => { await stopStream(o.id); setBlocked({ ...blocked, others: blocked.others.filter((x) => x.id !== o.id) }); }} className="rounded bg-white/15 px-3 py-1.5 text-sm font-semibold hover:bg-white/25">Stop</button>
            </li>
          ))}
        </ul>
        <div className="flex gap-3">
          <button onClick={() => { setBlocked(null); setAttempt((a) => a + 1); }} className="rounded bg-white px-6 py-2 font-semibold text-black">Try Again</button>
          <button onClick={() => router.push("/account/plan")} className="rounded border border-white/60 px-6 py-2">Upgrade Plan</button>
          <button onClick={() => router.push("/browse")} className="rounded border border-white/60 px-6 py-2">Back</button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-black px-6 text-center text-white">
        <p className="max-w-md text-lg">{error}</p>
        <div className="flex gap-3">
          <button onClick={() => setAttempt((a) => a + 1)} className="rounded bg-white px-6 py-2 font-semibold text-black">Try Again</button>
          <button onClick={() => router.push("/browse")} className="rounded border border-white/60 px-6 py-2">Back to Browse</button>
        </div>
      </div>
    );
  }

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
      streamId={streamId}
      email={ctx.account.email}
      profileName={ctx.profile.name}
    />
  );
}
