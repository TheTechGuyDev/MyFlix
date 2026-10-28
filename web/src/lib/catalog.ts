/**
 * The catalogue: filled from Supabase at start-up (titles, episodes and Home Curation from the
 * admin dashboard), plus the rules for rows, search and maturity limits.
 */

export type Maturity = "All" | "7+" | "13+" | "16+" | "18+";

export type Title = {
  id: string;
  title: string;
  image: string;
  type: "movie" | "series";
  year: number;
  maturity: Maturity;
  genres: string[];
  runtime?: string;
  seasons?: number;
  synopsis: string;
  cast: string[];
  tags: string[];
  match: number;
  original?: boolean;
  kids?: boolean;
  isNew?: boolean;
  comingSoon?: string;
  quality: "HD" | "4K";
  // Set by the admin dashboard
  backdrop?: string;
  directors?: string[];
  status?: "published" | "draft" | "scheduled" | "archived";
  releaseAt?: string;
  expiresAt?: string;
  video?: VideoAsset;
  seasonsData?: { number: number; episodes: EpisodeData[] }[];
  subtitles?: { id: string; lang: string; label: string; mediaId?: string; url?: string }[];
  audioTracks?: { id: string; lang: string; label: string; description?: boolean }[];
  introStart?: number;
  introEnd?: number;
  languages?: string[];
  sample?: boolean;
  hasVideo?: boolean;
};

export type VideoAsset = { source: "upload" | "url"; url?: string; mediaId?: string; height?: number; durationSec?: number };
export type EpisodeData = { id: string; number: number; title: string; runtime: string; synopsis: string; video?: VideoAsset; introStart?: number; introEnd?: number };

/** Unsplash id, or a full http(s)/data URL uploaded through the admin dashboard. */
export const img = (id: string, w = 600, h?: number) =>
  !id
    ? ""
    : id.startsWith("http") || id.startsWith("data:")
      ? id
      : `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}${h ? `&h=${h}` : ""}&q=70`;

/** Catalogue loaded from Supabase at start-up (see store.ts). Empty until then. */
export const catalog: Title[] = [];

/* ---------- Catalogue from Supabase ---------- */

export type Clip = { id: string; titleId: string; start: number; end: number; caption: string };
type Curation = { heroHome?: string; heroSeries?: string; heroMovies?: string; heroKids?: string; rows: { id: string; title: string; titleIds: string[]; enabled: boolean }[]; top10?: string[]; clips?: Clip[] };
let curationData: Curation | null = null;
export const curation = () => curationData;

export type DbTitle = {
  id: string; title: string; type: "movie" | "series"; synopsis: string; year: number | null; maturity: Maturity; genres: string[]; cast_list: string[];
  directors: string[]; tags: string[]; languages: string[]; image: string; backdrop: string | null; runtime: string | null; seasons: number | null;
  original: boolean; kids: boolean; is_new: boolean; quality: "HD" | "4K"; match: number; status: Title["status"]; release_at: string | null;
  expires_at: string | null; video: Record<string, unknown> | null; subtitles: { lang: string; label: string; url: string }[]; audio_tracks: { id: string; lang: string; label: string }[];
  intro_start: number | null; intro_end: number | null; sample: boolean;
};
export type DbEpisode = { id: string; title_id: string; season: number; number: number; title: string; runtime: string | null; synopsis: string; video: Record<string, unknown> | null; intro_start: number | null; intro_end: number | null };

const comingLabel = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }).replace(",", "");

/** Replaces the catalogue with the published titles from the database. */
export function applyRemoteCatalog(rows: DbTitle[], episodes: DbEpisode[], cur: Curation | null) {
  const now = Date.now();
  const list: Title[] = rows
    .filter((r) => (r.status === "published" || r.status === "scheduled") && (!r.expires_at || new Date(r.expires_at).getTime() > now))
    .map((r) => {
      const eps = episodes.filter((e) => e.title_id === r.id);
      const seasons = [...new Set(eps.map((e) => e.season))].sort((a, b) => a - b);
      const future = Boolean(r.release_at && new Date(r.release_at).getTime() > now);
      return {
        id: r.id,
        title: r.title,
        image: r.image,
        type: r.type,
        year: r.year ?? new Date().getFullYear(),
        maturity: r.maturity,
        genres: r.genres ?? [],
        runtime: r.runtime ?? undefined,
        seasons: r.type === "series" ? r.seasons ?? (seasons.length || 1) : undefined,
        synopsis: r.synopsis,
        cast: r.cast_list ?? [],
        tags: r.tags ?? [],
        match: r.match ?? 90,
        original: r.original,
        kids: r.kids,
        isNew: r.is_new,
        comingSoon: r.status === "scheduled" || future ? (r.release_at ? comingLabel(r.release_at) : "Soon") : undefined,
        quality: r.quality ?? "HD",
        backdrop: r.backdrop ?? undefined,
        directors: r.directors ?? [],
        status: r.status,
        releaseAt: r.release_at ?? undefined,
        expiresAt: r.expires_at ?? undefined,
        languages: r.languages ?? [],
        sample: r.sample,
        hasVideo: r.sample || (r.video as { status?: string } | null)?.status === "ready" || eps.some((e) => (e.video as { status?: string } | null)?.status === "ready"),
        subtitles: (r.subtitles ?? []).map((x, i) => ({ id: `s${i}`, lang: x.lang, label: x.label, url: x.url })),
        audioTracks: r.audio_tracks ?? [],
        introStart: r.intro_start ?? undefined,
        introEnd: r.intro_end ?? undefined,
        seasonsData: seasons.map((n) => ({
          number: n,
          episodes: eps.filter((e) => e.season === n).sort((a, b) => a.number - b.number).map((e) => ({ id: e.id, number: e.number, title: e.title, runtime: e.runtime ?? "", synopsis: e.synopsis, introStart: e.intro_start ?? undefined, introEnd: e.intro_end ?? undefined })),
        })),
      } as Title;
    });
  catalog.splice(0, catalog.length, ...list);
  curationData = cur;
}

export const byId = (id: string) => catalog.find((t) => t.id === id);

const ORDER: Maturity[] = ["All", "7+", "13+", "16+", "18+"];
/** True when a title's rating is within a profile's maturity limit. */
export const allowedFor = (t: Title, max: Maturity = "18+") => ORDER.indexOf(t.maturity) <= ORDER.indexOf(max);

export type Tab = "home" | "series" | "movies" | "new" | "mylist";

export type RowDef = { id: string; title: string; items: Title[]; ranked?: boolean; progress?: boolean };

const released = (t: Title) => !t.comingSoon;

export function rowsFor(tab: Tab, kids: boolean, max: Maturity = "18+"): RowDef[] {
  let pool = catalog.filter((t) => released(t) && allowedFor(t, max));
  if (kids) pool = pool.filter((t) => t.kids);
  if (tab === "series") pool = pool.filter((t) => t.type === "series");
  if (tab === "movies") pool = pool.filter((t) => t.type === "movie");

  const g = (genre: string) => pool.filter((t) => t.genres.includes(genre));
  const label = tab === "series" ? "Series" : tab === "movies" ? "Movies" : "";

  if (kids) {
    return [
      { id: "kids-popular", title: "Popular with Kids", items: [...pool].sort((a, b) => b.match - a.match) },
      { id: "kids-family", title: "Family Movie Night", items: g("Family") },
      { id: "kids-shows", title: "Kids' Shows", items: pool.filter((t) => t.type === "series") },
      { id: "kids-adventure", title: "Fun & Adventure", items: pool.filter((t) => t.genres.some((x) => ["Adventure", "Comedy", "Sports"].includes(x))) },
    ].filter((r) => r.items.length);
  }

  const pinned = tab === "home" && curationData?.top10?.length ? curationData.top10.map((id) => pool.find((t) => t.id === id)).filter((t): t is Title => Boolean(t)) : [];
  const top = pinned.length ? pinned.slice(0, 10) : [...pool].sort((a, b) => b.match - a.match).slice(0, 10);
  const custom: RowDef[] =
    tab === "home"
      ? (curationData?.rows ?? [])
          .filter((r) => r.enabled)
          .map((r) => ({ id: r.id, title: r.title, items: r.titleIds.map((id) => pool.find((t) => t.id === id)).filter((t): t is Title => Boolean(t)) }))
      : [];
  return [
    { id: "trending", title: `Trending Now${label ? ` in ${label}` : ""}`, items: [...pool].sort((a, b) => b.year - a.year || b.match - a.match).slice(0, 14) },
    { id: "top10", title: `Top 10 ${label || "Titles"} in Nigeria Today`, items: top, ranked: true },
    ...custom,
    { id: "nollywood", title: "Nollywood Hits", items: g("Nollywood") },
    { id: "originals", title: "Only on MyFlix", items: pool.filter((t) => t.original) },
    { id: "new", title: "New Releases", items: pool.filter((t) => t.isNew) },
    { id: "thrillers", title: "Crime & Thrillers", items: pool.filter((t) => t.genres.some((x) => ["Crime", "Thriller", "Suspense"].includes(x))) },
    { id: "comedy", title: "Comedies to Lift Your Mood", items: g("Comedy") },
    { id: "romance", title: "Love Stories", items: g("Romance") },
    { id: "family", title: "Family Favourites", items: g("Family") },
    { id: "horror", title: "Scary Nights", items: g("Horror") },
    { id: "docs", title: "Documentaries", items: g("Documentary") },
  ].filter((r) => r.items.length >= 2);
}

export function featuredFor(tab: Tab, kids: boolean, max: Maturity = "18+"): Title | null {
  const pool = catalog.filter((t) => released(t) && (!kids || t.kids) && allowedFor(t, max));
  const c = curationData;
  const pick = kids ? c?.heroKids : tab === "movies" ? c?.heroMovies : tab === "series" ? c?.heroSeries : c?.heroHome;
  const typed = pool.filter((t) => tab === "movies" ? t.type === "movie" : tab === "series" ? t.type === "series" : true);
  return pool.find((t) => t.id === pick && typed.includes(t)) ?? [...typed].sort((a, b) => b.match - a.match)[0] ?? pool[0] ?? null;
}

export function search(q: string, kids: boolean, max: Maturity = "18+"): Title[] {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  return catalog.filter(
    (t) =>
      (!kids || t.kids) &&
      allowedFor(t, max) &&
      [t.title, ...t.genres, ...t.cast, ...t.tags].some((x) => x.toLowerCase().includes(s)),
  );
}

export function similarTo(t: Title, kids: boolean, max: Maturity = "18+"): Title[] {
  return catalog
    .filter((x) => x.id !== t.id && (!kids || x.kids) && allowedFor(x, max) && x.genres.some((g) => t.genres.includes(g)))
    .slice(0, 9);
}

export function episodesFor(t: Title, season: number): { number: number; title: string; runtime: string; synopsis: string; video?: VideoAsset; introStart?: number; introEnd?: number }[] {
  return t.seasonsData?.find((s) => s.number === season)?.episodes ?? [];
}

export const comingSoon = () => catalog.filter((t) => t.comingSoon);
