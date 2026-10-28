// Members: checks membership + screen limit, then returns short-lived signed stream URLs.
import { env, HttpError, json, serve } from "../_shared/cors.ts";
import { admin, asUser, requireUser, settings } from "../_shared/supabase.ts";
import { resolutionFor, signPlayback } from "../_shared/mux.ts";

serve(async (req) => {
  await requireUser(req);
  const b = await req.json().catch(() => ({}));
  const titleId = String(b.title_id ?? "");
  const streamId = String(b.stream_id ?? "");
  if (!titleId || !streamId) throw new HttpError(400, "Missing title.");
  const cfg = await settings();
  if (cfg.maintenance === true) throw new HttpError(503, String(cfg.maintenanceMessage || "MyFlix is getting an upgrade. We'll be back shortly."));

  // Membership, suspension, profile ownership and screen limit (also used as the heartbeat)
  const { data: claim, error } = await asUser(req).rpc("claim_stream", { p_id: streamId, p_profile: b.profile_id, p_device: String(b.device ?? "Browser"), p_title: titleId });
  if (error) throw new HttpError(400, error.message);
  if (!claim?.ok) return json({ ok: false, ...claim });
  if (b.heartbeat) return json({ ok: true });

  const { data: t } = await admin.from("titles").select("id, type, video, sample, status, release_at, expires_at").eq("id", titleId).single();
  if (!t || !["published"].includes(t.status) || (t.release_at && new Date(t.release_at) > new Date()) || (t.expires_at && new Date(t.expires_at) < new Date())) {
    throw new HttpError(404, "This title isn't available right now.");
  }
  let video = t.video as Record<string, unknown> | null;
  let intro: { start: number; end: number } | null = null;
  if (t.type === "series") {
    const { data: ep } = await admin.from("episodes").select("video, intro_start, intro_end").eq("title_id", titleId).eq("season", b.season ?? 1).eq("number", b.episode ?? 1).single();
    video = (ep?.video as Record<string, unknown>) ?? video;
    if (ep?.intro_start != null && ep?.intro_end != null) intro = { start: ep.intro_start, end: ep.intro_end };
  }

  if (!video?.playback_id || video.status !== "ready") {
    // Sample titles imported for testing play the demo clip
    if (t.sample) return json({ ok: true, sources: [env("DEMO_VIDEO_URL") || "https://thetechguydev.github.io/MyFlix/media/demo.mp4"], sample: true, intro });
    throw new HttpError(409, "This video is still being prepared. Please try again shortly.");
  }

  const pid = String(video.playback_id);
  const ttl = 6 * 3600;
  const maxHeight = Number(claim.max_height ?? 1080);
  if (video.policy === "public") {
    return json({ ok: true, sources: [`https://stream.mux.com/${pid}.m3u8?max_resolution=${resolutionFor(maxHeight)}`], poster: `https://image.mux.com/${pid}/thumbnail.webp`, intro });
  }
  const [vt, tt, st] = await Promise.all([
    signPlayback(pid, "v", ttl, { max_resolution: resolutionFor(maxHeight) }),
    signPlayback(pid, "t", ttl),
    signPlayback(pid, "s", ttl),
  ]);
  const out: Record<string, unknown> = {
    ok: true,
    sources: [`https://stream.mux.com/${pid}.m3u8?token=${vt}`],
    poster: `https://image.mux.com/${pid}/thumbnail.webp?token=${tt}`,
    storyboard: `https://image.mux.com/${pid}/storyboard.vtt?token=${st}`,
    intro,
  };
  // Offline downloads (apps): MP4 rendition, if prepared
  if (b.download && video.mp4) out.download = `https://stream.mux.com/${pid}/highest.mp4?token=${vt}`;
  return json(out);
});
