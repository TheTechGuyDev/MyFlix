// Admin video uploads to Mux: direct browser uploads (any size, up to 4K), status sync, subtitles, delete.
import { env, fail, HttpError, json, serve } from "../_shared/cors.ts";
import { admin, audit, requireStaff } from "../_shared/supabase.ts";
import { mux, saveAsset } from "../_shared/mux.ts";

serve(async (req) => {
  const { user, name } = await requireStaff(req, "uploads");
  const body = await req.json().catch(() => ({}));
  const signed = env("MUX_PUBLIC_PLAYBACK") !== "true";

  if (body.action === "upload") {
    const titleId = String(body.title_id ?? "");
    const { data: t } = await admin.from("titles").select("id, title").eq("id", titleId).single();
    if (!t) throw new HttpError(404, "Save the title first, then upload its video.");
    const upload = await mux("/video/v1/uploads", {
      cors_origin: body.origin ?? "*",
      new_asset_settings: {
        playback_policy: [signed ? "signed" : "public"],
        passthrough: JSON.stringify({ t: titleId, e: body.episode_id ?? undefined }),
        video_quality: env("MUX_VIDEO_QUALITY") || "basic",
        max_resolution_tier: "2160p",
        // Captions generated automatically in English; editable subtitle files can be added later
        input: [{ generated_subtitles: [{ language_code: "en", name: "English (auto)" }] }],
        static_renditions: body.downloads === false ? undefined : [{ resolution: "highest" }],
      },
    });
    const video = { provider: "mux", upload_id: upload.id, status: "uploading", updated_at: new Date().toISOString() };
    if (body.episode_id) await admin.from("episodes").update({ video }).eq("id", body.episode_id);
    else await admin.from("titles").update({ video }).eq("id", titleId);
    await audit(user.id, name, "Started video upload", `${t.title}${body.episode_id ? ` (episode ${body.episode_id})` : ""}`);
    return json({ url: upload.url, upload_id: upload.id });
  }

  if (body.action === "status") {
    const up = await mux(`/video/v1/uploads/${encodeURIComponent(body.upload_id)}`);
    if (!up.asset_id) return json({ status: up.status === "errored" ? "error" : "uploading" });
    const asset = await mux(`/video/v1/assets/${up.asset_id}`);
    await saveAsset(asset);
    return json({ status: asset.status === "ready" ? "ready" : asset.status === "errored" ? "error" : "processing", asset_id: asset.id, duration: asset.duration, height: asset.tracks?.find((x: { type: string }) => x.type === "video")?.max_height });
  }

  if (body.action === "subtitle") {
    // Adds a subtitle file (already uploaded to the 'subtitles' storage bucket) to the Mux asset
    const track = await mux(`/video/v1/assets/${encodeURIComponent(body.asset_id)}/tracks`, {
      url: body.url,
      type: "text",
      text_type: "subtitles",
      language_code: body.lang ?? "en",
      name: body.label ?? body.lang ?? "Subtitles",
      closed_captions: false,
    });
    await audit(user.id, name, "Added subtitles", `${body.label} on asset ${body.asset_id}`);
    return json({ track_id: track.id });
  }

  if (body.action === "delete") {
    await mux(`/video/v1/assets/${encodeURIComponent(body.asset_id)}`, undefined, "DELETE");
    await audit(user.id, name, "Deleted video", String(body.asset_id));
    return json({ ok: true });
  }

  if (body.action === "usage") {
    // How many assets exist (Mux free plan allows 10)
    const assets = await mux("/video/v1/assets?limit=100");
    return json({ assets: assets.length });
  }

  return fail("Unknown action.");
});
