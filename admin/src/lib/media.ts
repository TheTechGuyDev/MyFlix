"use client";

import { fn, sb } from "./supabase";

/* ---------------- Images (posters and backdrops) ---------------- */

/** Shrinks an image to a JPEG so posters load fast on Nigerian mobile data. */
function shrink(file: File, maxW: number, quality = 0.85): Promise<Blob> {
  return new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? res(b) : rej(new Error("Could not read image"))), "image/jpeg", quality);
    };
    img.onerror = () => rej(new Error("Could not read image"));
    img.src = url;
  });
}

/** Uploads artwork to the public 'artwork' bucket and returns its URL. */
export async function uploadArtwork(file: File, maxW: number): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  const blob = await shrink(file, maxW);
  const path = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.jpg`;
  const { error } = await sb().storage.from("artwork").upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (error) throw new Error(error.message);
  return sb().storage.from("artwork").getPublicUrl(path).data.publicUrl;
}

/** Removes artwork we uploaded (ignores outside links). */
export async function deleteArtwork(url: string) {
  const m = url.match(/\/storage\/v1\/object\/public\/artwork\/(.+)$/);
  if (m) await sb().storage.from("artwork").remove([decodeURIComponent(m[1])]);
}

/* ---------------- Subtitles ---------------- */

export function srtToVtt(text: string) {
  if (text.trimStart().startsWith("WEBVTT")) return text;
  return "WEBVTT\n\n" + text.replace(/\r/g, "").replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
}

/** Stores a WebVTT file in the 'subtitles' bucket and, when the title has a Mux video, adds it to the stream too. */
export async function uploadSubtitle(titleId: string, lang: string, label: string, vtt: string, assetId?: string): Promise<string> {
  const path = `${titleId}/${lang}-${Date.now()}.vtt`;
  const { error } = await sb().storage.from("subtitles").upload(path, new Blob([vtt], { type: "text/vtt" }), { contentType: "text/vtt", upsert: true });
  if (error) throw new Error(error.message);
  const url = sb().storage.from("subtitles").getPublicUrl(path).data.publicUrl;
  if (assetId) await fn("mux", { action: "subtitle", asset_id: assetId, url, lang, label }).catch(() => undefined);
  return url;
}

export async function deleteSubtitle(url?: string) {
  const m = url?.match(/\/storage\/v1\/object\/public\/subtitles\/(.+)$/);
  if (m) await sb().storage.from("subtitles").remove([decodeURIComponent(m[1])]);
}

/* ---------------- Video (Mux direct upload) ---------------- */

export type UploadHandle = { promise: Promise<string>; cancel: () => void };

/**
 * Sends a video straight from the browser to Mux. The file never touches our servers,
 * so any size up to 4K works. Resolves with the Mux upload id.
 */
export function uploadVideo(file: File, opts: { titleId: string; episodeId?: string; onProgress: (pct: number) => void }): UploadHandle {
  let xhr: XMLHttpRequest | null = null;
  let cancelled = false;
  const promise = (async () => {
    const { url, upload_id } = await fn<{ url: string; upload_id: string }>("mux", { action: "upload", title_id: opts.titleId, episode_id: opts.episodeId, origin: location.origin });
    if (cancelled) throw new Error("Upload cancelled.");
    await new Promise<void>((res, rej) => {
      xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.upload.onprogress = (e) => e.lengthComputable && opts.onProgress(e.loaded / e.total);
      xhr.onload = () => (xhr!.status < 300 ? res() : rej(new Error(`Upload failed (${xhr!.status}). Try again.`)));
      xhr.onerror = () => rej(new Error("Network error during upload. Check your connection and try again."));
      xhr.onabort = () => rej(new Error("Upload cancelled."));
      xhr.send(file);
    });
    return upload_id;
  })();
  return {
    promise,
    cancel: () => {
      cancelled = true;
      xhr?.abort();
    },
  };
}

export type MuxStatus = { status: "uploading" | "processing" | "ready" | "error"; asset_id?: string; duration?: number; height?: number };
export const videoStatus = (upload_id: string) => fn<MuxStatus>("mux", { action: "status", upload_id });

/** Number of videos stored on Mux (the free plan allows 10). */
export const videoCount = () => fn<{ assets: number }>("mux", { action: "usage" }).then((r) => r.assets);
