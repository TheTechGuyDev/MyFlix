"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getAccount, getActiveProfileId, setActiveProfile, signOut, type Account, type Profile } from "@/lib/mock-auth";
import { byId, catalog, comingSoon, featuredFor, img, rowsFor, search, type RowDef, type Tab, type Title } from "@/lib/catalog";
import { useLibrary, type LibraryApi } from "@/lib/library";
import Navbar from "./Navbar";
import Hero from "./Hero";
import Row from "./Row";
import TitleCard from "./TitleCard";
import DetailsModal from "./DetailsModal";
import { BellIcon, InfoIcon } from "./icons";

const TABS: Tab[] = ["home", "series", "movies", "new", "mylist"];
const SEED = ["no-witness", "chairmans-son", "danfo-diaries"];
const KIDS_SEED = ["compound-kids", "market-day"];

export default function BrowseApp() {
  const router = useRouter();
  const params = useSearchParams();
  const [account, setAccount] = useState<Account | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Title | null>(null);
  const [notice, setNotice] = useState("");

  const rawTab = params.get("tab") as Tab | null;
  const tab: Tab = rawTab && TABS.includes(rawTab) ? rawTab : "home";
  const kids = Boolean(profile?.kids);

  useEffect(() => {
    const acc = getAccount();
    if (!acc) return router.replace("/login");
    const p = acc.profiles.find((x) => x.id === getActiveProfileId());
    if (!p) return router.replace("/profiles");
    setAccount(acc);
    setProfile(p);
  }, [router]);

  const library = useLibrary(profile?.id ?? null, kids ? KIDS_SEED : SEED);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 3200);
    return () => clearTimeout(id);
  }, [notice]);

  const setTab = (t: Tab) => {
    setQuery("");
    router.replace(t === "home" ? "/browse" : `/browse?tab=${t}`, { scroll: false });
    window.scrollTo({ top: 0 });
  };

  const play = useCallback((t: Title) => setNotice(`Playing "${t.title}". The video player arrives in the next step.`), []);
  const openTitle = useCallback((t: Title) => setOpen(t), []);
  const closeModal = useCallback(() => setOpen(null), []);

  const rows = useMemo<RowDef[]>(() => {
    if (!profile) return [];
    const base = rowsFor(tab === "new" ? "home" : tab, kids);
    const continueItems = Object.entries(library.lib.progress)
      .sort((a, b) => b[1].updatedAt.localeCompare(a[1].updatedAt))
      .map(([id]) => byId(id))
      .filter((t): t is Title => Boolean(t) && (!kids || Boolean(t!.kids)))
      .filter((t) => tab === "home" || (tab === "series" ? t.type === "series" : tab === "movies" ? t.type === "movie" : true));
    const myList = library.lib.list.map(byId).filter((t): t is Title => Boolean(t));

    const out = [...base];
    if (continueItems.length) out.splice(0, 0, { id: "continue", title: `Continue Watching for ${profile.name}`, items: continueItems, progress: true });
    if (tab === "home" && myList.length) out.splice(continueItems.length ? 2 : 1, 0, { id: "mylist", title: "My List", items: myList });
    return out;
  }, [profile, tab, kids, library.lib]);

  if (!profile || !account) return <div className="min-h-screen bg-ink" />;

  const switchProfile = (p: Profile) => {
    setActiveProfile(p.id);
    setProfile(p);
    setQuery("");
    setOpen(null);
    router.replace("/browse", { scroll: false });
    window.scrollTo({ top: 0 });
  };

  const results = query ? search(query, kids) : null;

  return (
    <div className="min-h-screen overflow-x-hidden bg-ink">
      <Navbar
        tab={tab}
        onTab={setTab}
        query={query}
        onQuery={setQuery}
        profile={profile}
        profiles={account.profiles}
        onSwitch={switchProfile}
        onSignOut={() => {
          signOut();
          router.push("/");
        }}
        onOpenTitle={(id) => setOpen(byId(id) ?? null)}
        onNotice={setNotice}
      />

      {results ? (
        <SearchResults query={query} results={results} library={library} onOpen={openTitle} onPlay={play} />
      ) : tab === "mylist" ? (
        <MyList library={library} onOpen={openTitle} onPlay={play} onBrowse={() => setTab("home")} />
      ) : tab === "new" ? (
        <NewAndPopular library={library} rows={rows} onOpen={openTitle} onPlay={play} />
      ) : (
        <>
          <Hero title={featuredFor(tab, kids)} onPlay={play} onInfo={openTitle} />
          <div className="relative z-10 -mt-12 space-y-6 pb-10 sm:-mt-20 sm:space-y-10 lg:-mt-32">
            {rows.map((r) => (
              <Row key={r.id} row={r} library={library} onOpen={openTitle} onPlay={play} />
            ))}
          </div>
        </>
      )}

      <BrowseFooter />

      {open && <DetailsModal title={open} kids={kids} library={library} onClose={closeModal} onPlay={play} onOpen={openTitle} />}

      {notice && (
        <div role="status" className="fixed bottom-6 left-1/2 z-[60] w-[90%] max-w-md -translate-x-1/2 rounded-md bg-white px-4 py-3 text-center text-sm font-medium text-ink shadow-2xl">
          {notice}
        </div>
      )}
    </div>
  );
}

function Grid({ items, library, onOpen, onPlay }: { items: Title[]; library: LibraryApi; onOpen: (t: Title) => void; onPlay: (t: Title) => void }) {
  return (
    <div className="grid grid-cols-2 gap-x-2 gap-y-6 sm:grid-cols-3 md:grid-cols-4 md:gap-y-28 lg:grid-cols-5 xl:grid-cols-6">
      {items.map((t) => (
        <TitleCard key={t.id} title={t} library={library} onOpen={onOpen} onPlay={onPlay} fluid />
      ))}
    </div>
  );
}

function SearchResults({ query, results, ...rest }: { query: string; results: Title[]; library: LibraryApi; onOpen: (t: Title) => void; onPlay: (t: Title) => void }) {
  const suggestions = ["Nollywood", "Comedy", "Thriller", "Documentary", "Family", "Romance"];
  return (
    <main className="min-h-screen px-4 pb-32 pt-28 sm:px-10 lg:px-14">
      {results.length ? (
        <>
          <p className="mb-6 text-white/60">
            Results for <span className="text-white">&ldquo;{query}&rdquo;</span>
          </p>
          <Grid items={results} {...rest} />
        </>
      ) : (
        <div className="mx-auto max-w-lg pt-10 text-center text-white/80">
          <p>Your search for &ldquo;{query}&rdquo; did not have any matches.</p>
          <p className="mt-4">Suggestions:</p>
          <ul className="mt-2 list-inside list-disc text-left text-white/70 sm:inline-block">
            <li>Try different keywords</li>
            <li>Looking for a movie or series? Try the title</li>
            <li>Try a genre, like {suggestions.slice(0, 3).join(", ")}</li>
          </ul>
        </div>
      )}
    </main>
  );
}

function MyList({ library, onBrowse, ...rest }: { library: LibraryApi; onOpen: (t: Title) => void; onPlay: (t: Title) => void; onBrowse: () => void }) {
  const items = library.lib.list.map(byId).filter((t): t is Title => Boolean(t));
  return (
    <main className="min-h-screen px-4 pb-32 pt-28 sm:px-10 lg:px-14">
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">My List</h1>
      {items.length ? (
        <Grid items={items} library={library} {...rest} />
      ) : (
        <div className="py-20 text-center text-white/70">
          <p className="text-lg">You haven&apos;t added any titles to your list yet.</p>
          <p className="mt-2">Tap + on any title to save it here for later.</p>
          <button onClick={onBrowse} className="mt-6 rounded bg-white px-6 py-2 font-semibold text-ink hover:bg-white/80">Browse titles</button>
        </div>
      )}
    </main>
  );
}

function NewAndPopular({ library, rows, onOpen, onPlay }: { library: LibraryApi; rows: RowDef[]; onOpen: (t: Title) => void; onPlay: (t: Title) => void }) {
  const [reminders, setReminders] = useState<string[]>([]);
  const fresh: RowDef = { id: "fresh", title: "New on MyFlix", items: catalog.filter((t) => t.isNew && !t.comingSoon) };
  const top = rows.find((r) => r.id === "top10");

  return (
    <main className="min-h-screen pb-10 pt-24">
      <div className="space-y-8">
        <Row row={fresh} library={library} onOpen={onOpen} onPlay={onPlay} />
        {top && <Row row={top} library={library} onOpen={onOpen} onPlay={onPlay} />}
      </div>
      <section className="mt-6 px-4 sm:px-10 lg:px-14">
        <h2 className="mb-4 text-lg font-bold sm:text-xl">Coming Soon</h2>
        <ul className="space-y-8">
          {comingSoon().map((t) => {
            const on = reminders.includes(t.id);
            return (
              <li key={t.id} className="grid gap-4 sm:grid-cols-[120px_1fr] lg:grid-cols-[120px_minmax(0,560px)_1fr]">
                <div className="text-white/70">
                  <p className="text-sm uppercase">{t.comingSoon!.split(" ")[0]}</p>
                  <p className="font-display text-5xl leading-none text-white">{t.comingSoon!.split(" ")[1]} <span className="text-2xl">{t.comingSoon!.split(" ")[2]}</span></p>
                </div>
                <div>
                  <div className="relative aspect-video overflow-hidden rounded-md">
                    <Image src={img(t.image, 900, 506)} alt="" fill sizes="560px" className="object-cover" />
                    <span className="font-display absolute bottom-3 left-4 text-4xl drop-shadow-lg">{t.title}</span>
                  </div>
                  <div className="mt-3 flex items-center gap-6">
                    <button onClick={() => setReminders((r) => (on ? r.filter((x) => x !== t.id) : [...r, t.id]))} className={`flex flex-col items-center text-xs ${on ? "text-brand-bright" : "text-white/80 hover:text-white"}`}>
                      <BellIcon className="h-6 w-6" /> {on ? "Reminder set" : "Remind Me"}
                    </button>
                    <button onClick={() => onOpen(t)} className="flex flex-col items-center text-xs text-white/80 hover:text-white">
                      <InfoIcon className="h-6 w-6" /> Info
                    </button>
                  </div>
                  <p className="mt-3 text-sm text-white/60">Coming {t.comingSoon}</p>
                  <h3 className="mt-1 text-xl font-bold">{t.title}</h3>
                  <p className="mt-1 text-sm text-white/80">{t.synopsis}</p>
                  <p className="mt-2 text-xs text-white/60">{t.tags.concat(t.genres).join(" • ")}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}

function BrowseFooter() {
  const links = ["Audio Description", "Help Centre", "Gift Cards", "Media Centre", "Investor Relations", "Jobs", "Terms of Use", "Privacy", "Legal Notices", "Cookie Preferences", "Corporate Information", "Contact Us"];
  return (
    <footer className="mx-auto max-w-5xl px-4 pb-14 pt-8 text-sm text-white/50 sm:px-10">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {links.map((l) => (
          <li key={l}><Link href="/#faq" className="hover:underline">{l}</Link></li>
        ))}
      </ul>
      <p className="mt-6 inline-block border border-white/40 px-2 py-1 text-xs">Service Code</p>
      <p className="mt-4 text-xs">© 2026 MyFlix Nigeria</p>
    </footer>
  );
}
