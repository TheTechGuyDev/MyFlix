"use client";

/** Reads videos and subtitle files uploaded in the admin dashboard (IndexedDB on the same site). */
export async function getMediaUrl(id: string): Promise<string | null> {
  try {
    const db: IDBDatabase = await new Promise((res, rej) => {
      const req = indexedDB.open("myflix-media", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("files");
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    const blob: Blob | null = await new Promise((res) => {
      const r = db.transaction("files").objectStore("files").get(id);
      r.onsuccess = () => res((r.result as Blob) ?? null);
      r.onerror = () => res(null);
    });
    return blob ? URL.createObjectURL(blob) : null;
  } catch {
    return null;
  }
}
