import { beforeEach, describe, expect, it } from "vitest";
import { allowedFor, applyRemoteCatalog, byId, catalog, episodesFor, featuredFor, img, rowsFor, search, type DbEpisode, type DbTitle } from "./catalog";

const row = (id: string, p: Partial<DbTitle> = {}): DbTitle => ({
  id, title: id.toUpperCase(), type: "movie", synopsis: "", year: 2026, maturity: "13+", genres: ["Drama"], cast_list: [], directors: [], tags: [], languages: [],
  image: "", backdrop: null, runtime: null, seasons: null, original: false, kids: false, is_new: false, quality: "HD", match: 90, status: "published",
  release_at: null, expires_at: null, video: null, subtitles: [], audio_tracks: [], intro_start: null, intro_end: null, sample: false, ...p,
});
const ep = (id: string, title_id: string, season: number, number: number, video: Record<string, unknown> | null = null): DbEpisode => ({ id, title_id, season, number, title: id, runtime: null, synopsis: "", video, intro_start: null, intro_end: null });

describe("catalogue from the database", () => {
  beforeEach(() => {
    applyRemoteCatalog(
      [
        row("ready", { video: { status: "ready" } }),
        row("encoding", { video: { status: "processing" } }),
        row("draft", { status: "draft" }),
        row("expired", { expires_at: "2020-01-01T00:00:00Z" }),
        row("soon", { status: "scheduled", release_at: new Date(Date.now() + 5 * 864e5).toISOString() }),
        row("show", { type: "series", genres: ["Thriller"] }),
        row("adult", { maturity: "18+", genres: ["Thriller"] }),
        row("kid", { kids: true, maturity: "All", genres: ["Family"] }),
      ],
      [ep("e2", "show", 1, 2, { status: "ready" }), ep("e1", "show", 1, 1), ep("e3", "show", 2, 1)],
      { heroHome: "show", rows: [{ id: "picks", title: "Staff picks", titleIds: ["show", "ready"], enabled: true }], top10: [] },
    );
  });

  it("hides drafts and expired titles", () => {
    expect(byId("draft")).toBeUndefined();
    expect(byId("expired")).toBeUndefined();
    expect(byId("ready")).toBeDefined();
  });
  it("marks playable titles", () => {
    expect(byId("ready")?.hasVideo).toBe(true);
    expect(byId("encoding")?.hasVideo).toBe(false);
    expect(byId("show")?.hasVideo).toBe(true);
  });
  it("shows scheduled titles as coming soon", () => expect(byId("soon")?.comingSoon).toBeTruthy());
  it("builds seasons from episode rows", () => {
    const show = byId("show")!;
    expect(show.seasonsData?.map((s) => s.number)).toEqual([1, 2]);
    expect(episodesFor(show, 1).map((e) => e.title)).toEqual(["e1", "e2"]);
  });
  it("respects maturity and kids profiles", () => {
    expect(allowedFor(byId("adult")!, "16+")).toBe(false);
    expect(search("t", true).every((t) => t.kids)).toBe(true);
  });
  it("uses Home Curation for the hero and rows", () => {
    expect(featuredFor("home", false)?.id).toBe("show");
    expect(rowsFor("home", false).some((r) => r.title === "Staff picks")).toBe(true);
  });
  it("copes with an empty catalogue", () => {
    applyRemoteCatalog([], [], null);
    expect(catalog).toHaveLength(0);
    expect(featuredFor("home", false)).toBeNull();
    expect(rowsFor("home", false)).toEqual([]);
  });
  it("accepts uploaded artwork URLs and stock ids", () => {
    expect(img("https://x.supabase.co/a.jpg")).toBe("https://x.supabase.co/a.jpg");
    expect(img("abc", 300)).toContain("photo-abc");
  });
});
