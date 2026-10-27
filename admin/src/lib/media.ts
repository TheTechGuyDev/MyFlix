"use client";

/** IndexedDB media store shared with the web player (same site, same database). */
const DB = "myflix-media";
const STORE = "files";

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

export async function putMedia(id: string, blob: Blob) {
  const db = await open();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function getMedia(id: string): Promise<Blob | null> {
  const db = await open();
  return new Promise((res, rej) => {
    const req = db.transaction(STORE).objectStore(STORE).get(id);
    req.onsuccess = () => res((req.result as Blob) ?? null);
    req.onerror = () => rej(req.error);
  });
}

export async function deleteMedia(id: string) {
  const db = await open();
  await new Promise<void>((res) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => res();
  });
}

export async function storageEstimate() {
  try {
    const e = await navigator.storage?.estimate?.();
    return { used: e?.usage ?? 0, quota: e?.quota ?? 0 };
  } catch {
    return { used: 0, quota: 0 };
  }
}

/** Reads width, height and duration from a local video file. */
export function probeVideo(file: File): Promise<{ width: number; height: number; duration: number }> {
  return new Promise((res) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    const url = URL.createObjectURL(file);
    v.onloadedmetadata = () => {
      res({ width: v.videoWidth, height: v.videoHeight, duration: isFinite(v.duration) ? v.duration : 0 });
      URL.revokeObjectURL(url);
    };
    v.onerror = () => {
      res({ width: 0, height: 0, duration: 0 });
      URL.revokeObjectURL(url);
    };
    v.src = url;
  });
}

/** Shrinks an image file to a JPEG data URL so posters fit in browser storage. */
export function imageToDataUrl(file: File, maxW = 800, quality = 0.82): Promise<string> {
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
      res(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => rej(new Error("Could not read image"));
    img.src = url;
  });
}
