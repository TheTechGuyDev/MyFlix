"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Avatar from "@/components/auth/Avatar";
import Player from "@/components/player/Player";
import { allowedFor, byId, catalog, episodesFor, featuredFor, img, rowsFor, search, similarTo, type RowDef, type Tab, type Title } from "@/lib/catalog";
import { langFromName, translator } from "@/lib/i18n";
import { readProgress, useLibrary } from "@/lib/library";
import { settingsOf, type Account, type Profile } from "@/lib/mock-auth";
import { resolveMedia, type ResolvedMedia } from "@/lib/resolve-media";
import { checkTvCode, codeExpired, createTvCode, getTvSession, setTvSession, tvAccount, type TvSession } from "@/lib/tv";
import { useSpatialNav } from "./useSpatialNav";

/**
 * MyFlix for Smart TVs (Samsung Tizen, LG webOS, Android TV browsers, set-top boxes).
 * A 10-foot interface driven entirely by the remote: arrow keys, OK and Back.
 */
const noop = () => () => {};
export default function TvApp() {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  if (!mounted) return <div className="fixed inset-0 bg-black" />;
  return <TvInner />;
}

type Screen =
  | { name: "pair" }
  | { name: "profiles" }
  | { name: "pin"; profile: Profile }
  | { name: "home" }
  | { name: "details"; title: Title }
  | { name: "player"; title: Title; season: number; episode: number; back: Screen };

type Section = "search" | Tab;

function TvInner() {
  const [session, setSession] = useState<TvSession | null>(() => getTvSession());
  const account = useMemo(() => tvAccount(session), [session]);
  const [profile, setProfile] = useState<Profile | null>(() => account?.profiles.find((p) => p.id === session?.profileId) ?? null);
  const [screen, setScreen] = useState<Screen>(() => (!account ? { name: "pair" } : profile ? { name: "home" } : { name: "profiles" }));

  const signOut = useCallback(() => {
    setTvSession(null);
    setSession(null);
    setProfile(null);
    setScreen({ name: "pair" });
  }, []);

  const onPaired = (s: TvSession) => {
    setTvSession(s);
    setSession(s);
    setScreen({ name: "profiles" });
  };

  const chooseProfile = (p: Profile) => {
    const s = settingsOf(p);
    if (s.pin) return setScreen({ name: "pin", profile: p });
    enter(p);
  };
  const enter = (p: Profile) => {
    const next = { ...session!, profileId: p.id };
    setTvSession(next);
    setSession(next);
    setProfile(p);
    setScreen({ name: "home" });
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#0a0a0b] text-white [font-size:clamp(14px,1.25vw,30px)]">
      {screen.name === "pair" && <Pairing onPaired={onPaired} />}
      {screen.name === "profiles" && account && <Profiles account={account} onPick={chooseProfile} onSignOut={signOut} />}
      {screen.name === "pin" && <PinPad profile={screen.profile} onOk={() => enter(screen.profile)} onBack={() => setScreen({ name: "profiles" })} />}
      {account && profile && (screen.name === "home" || screen.name === "details" || screen.name === "player") && (
        <Main account={account} profile={profile} screen={screen} setScreen={setScreen} onSwitch={() => setScreen({ name: "profiles" })} onSignOut={signOut} />
      )}
    </div>
  );
}

/* ---------------- Pairing ---------------- */
function Pairing({ onPaired }: { onPaired: (s: TvSession) => void }) {
  const [code, setCode] = useState(() => createTvCode());
  const [left, setLeft] = useState(15 * 60);
  useSpatialNav(useCallback(() => {}, []));

  useEffect(() => {
    const id = setInterval(() => {
      const hit = checkTvCode(code);
      if (hit) {
        clearInterval(id);
        const app = hit.startsWith("app:");
        onPaired({ email: app ? hit.slice(4) : hit, source: app ? "app" : "web", pairedAt: new Date().toISOString() });
        return;
      }
      setLeft((l) => {
        if (l <= 1 || codeExpired(code)) {
          setCode(createTvCode());
          return 15 * 60;
        }
        return l - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [code, onPaired]);

  const base = typeof window !== "undefined" ? `${location.origin}${location.pathname.replace(/\/tv\/?$/, "")}` : "";
  const pretty = `${code.slice(0, 4)} ${code.slice(4)}`;
  return (
    <div className="grid h-full grid-cols-2 items-center gap-[4vw] px-[8vw]">
      <div>
        <p className="font-display text-[5em] leading-none tracking-wide">MY<span className="text-brand-bright">FLIX</span></p>
        <h1 className="mt-[1.5em] text-[2.4em] font-bold">Sign in with your phone</h1>
        <ol className="mt-[1em] space-y-[0.8em] text-[1.2em] text-white/80">
          <li><b className="text-white">1.</b> On your phone, open the MyFlix app and go to <b className="text-white">My MyFlix, Sign in on TV</b>.</li>
          <li><b className="text-white">2.</b> Or on a computer, visit <b className="text-white">{base.replace(/^https?:\/\//, "")}/account/tv</b>.</li>
          <li><b className="text-white">3.</b> Enter the code on the right.</li>
        </ol>
        <a
          data-nav
          data-nav-default
          href={`${base}/account/tv/?code=${code}`}
          target="_blank"
          rel="noreferrer"
          className="mt-[2em] inline-block rounded-md bg-white/10 px-[1.4em] py-[0.7em] text-[1em] font-semibold outline-none ring-white focus:bg-white focus:text-black"
        >
          Demo: approve from this browser
        </a>
      </div>
      <div className="rounded-2xl bg-white/5 p-[3em] text-center">
        <p className="text-[1.2em] uppercase tracking-[0.3em] text-white/60">Your code</p>
        <p aria-live="polite" className="mt-[0.4em] whitespace-nowrap font-mono text-[4em] font-bold tracking-[0.1em]">{pretty}</p>
        <p className="mt-[1em] text-white/60">Code refreshes in {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</p>
        <p className="mt-[2em] flex items-center justify-center gap-2 text-white/60">
          <span className="inline-block h-[0.7em] w-[0.7em] animate-pulse rounded-full bg-brand-bright" /> Waiting for your phone…
        </p>
      </div>
    </div>
  );
}

/* ---------------- Profiles ---------------- */
function Profiles({ account, onPick, onSignOut }: { account: Account; onPick: (p: Profile) => void; onSignOut: () => void }) {
  useSpatialNav(useCallback(() => {}, []));
  return (
    <div className="flex h-full flex-col items-center justify-center">
      <h1 className="text-[3em] font-medium">Who&apos;s watching?</h1>
      <ul className="mt-[2em] flex gap-[2.5em]">
        {account.profiles.map((p, i) => (
          <li key={p.id}>
            <button data-nav data-nav-default={i === 0 ? "" : undefined} onClick={() => onPick(p)} className="group flex flex-col items-center gap-[0.8em] rounded-lg p-2 outline-none">
              <span className="block rounded-lg ring-white transition group-focus:scale-110 group-focus:ring-[0.25em]">
                <Avatar index={p.avatar} kids={p.kids} className="h-[9em] w-[9em] rounded-lg" />
              </span>
              <span className="text-[1.4em] text-white/60 group-focus:text-white">{p.name}{settingsOf(p).pin ? " 🔒" : ""}</span>
            </button>
          </li>
        ))}
      </ul>
      <button data-nav onClick={onSignOut} className="mt-[3em] rounded border border-white/40 px-[1.6em] py-[0.5em] text-[1.1em] text-white/70 outline-none focus:border-white focus:bg-white focus:text-black">
        Sign out of this TV
      </button>
    </div>
  );
}

function PinPad({ profile, onOk, onBack }: { profile: Profile; onOk: () => void; onBack: () => void }) {
  const [pin, setPin] = useState("");
  const [bad, setBad] = useState(false);
  useSpatialNav(onBack);
  const press = (d: string) => {
    const next = (pin + d).slice(0, 4);
    setBad(false);
    setPin(next);
    if (next.length === 4) {
      if (next === settingsOf(profile).pin) onOk();
      else {
        setBad(true);
        setPin("");
      }
    }
  };
  return (
    <div className="flex h-full flex-col items-center justify-center gap-[1.5em]">
      <p className="text-white/60">Profile lock is on.</p>
      <h1 className="text-[2.4em] font-semibold">Enter your PIN to access {profile.name}</h1>
      <div className="flex gap-[0.8em]">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`flex h-[3.4em] w-[3.4em] items-center justify-center rounded border-2 text-[1.6em] ${bad ? "border-danger" : "border-white/60"}`}>{pin[i] ? "•" : ""}</span>
        ))}
      </div>
      {bad && <p className="text-danger">Whoops, wrong PIN. Please try again.</p>}
      <div className="grid grid-cols-3 gap-[0.6em]">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k, i) =>
          k ? (
            <button key={i} data-nav data-nav-default={k === "5" ? "" : undefined} onClick={() => (k === "⌫" ? setPin(pin.slice(0, -1)) : press(k))} className="h-[3em] w-[4.5em] rounded bg-white/10 text-[1.5em] font-semibold outline-none focus:bg-white focus:text-black">
              {k}
            </button>
          ) : (
            <span key={i} />
          ),
        )}
      </div>
    </div>
  );
}

/* ---------------- Main (rail + home / details / player) ---------------- */
const RAIL: { id: Section; label: string; icon: string }[] = [
  { id: "search", label: "Search", icon: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.5-4.5" },
  { id: "home", label: "Home", icon: "M3 11 12 4l9 7v9H15v-6H9v6H3z" },
  { id: "series", label: "Series", icon: "M3 6h18v12H3zM8 21h8" },
  { id: "movies", label: "Movies", icon: "M4 5h16v14H4zM4 9h16M8 5v4M16 5v4" },
  { id: "new", label: "New & Popular", icon: "M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z" },
  { id: "mylist", label: "My List", icon: "M12 5v14M5 12h14" },
];

function Main({ account, profile, screen, setScreen, onSwitch, onSignOut }: { account: Account; profile: Profile; screen: Screen; setScreen: (s: Screen) => void; onSwitch: () => void; onSignOut: () => void }) {
  const s = settingsOf(profile);
  const tx = useMemo(() => translator(langFromName(s.language)), [s.language]);
  const kids = profile.kids;
  const max = s.maturity;
  const library = useLibrary(profile.id);
  const [section, setSection] = useState<Section>("home");
  const [focused, setFocused] = useState<Title>(() => featuredFor("home", kids, max));
  const [query, setQuery] = useState("");
  const [railOpen, setRailOpen] = useState(false);

  const back = useCallback(() => {
    if (screen.name === "details") setScreen({ name: "home" });
    else if (screen.name === "home") {
      if (section !== "home") setSection("home");
      else onSwitch();
    }
  }, [screen.name, section, setScreen, onSwitch]);
  useSpatialNav(back, screen.name !== "player");

  const rows = useMemo<RowDef[]>(() => {
    if (section === "search") return [];
    if (section === "mylist") return [{ id: "mylist", title: "My List", items: library.lib.list.map(byId).filter((t): t is Title => Boolean(t) && allowedFor(t!, max)) }];
    const base = rowsFor(section, kids, max);
    const cont = Object.entries(library.lib.progress)
      .sort((a, b) => b[1].updatedAt.localeCompare(a[1].updatedAt))
      .map(([id]) => byId(id))
      .filter((t): t is Title => Boolean(t) && (!kids || Boolean(t!.kids)) && allowedFor(t!, max));
    return cont.length && section === "home" ? [{ id: "continue", title: `Continue Watching for ${profile.name}`, items: cont, progress: true }, ...base] : base;
  }, [section, kids, max, library.lib, profile.name]);

  const results = section === "search" && query ? search(query, kids, max) : [];
  const suggestions = section === "search" && !query ? catalog.filter((t) => !t.comingSoon && (!kids || t.kids) && allowedFor(t, max)).slice(0, 12) : [];

  const play = (t: Title, season?: number, episode?: number) => {
    if (t.comingSoon) return;
    const p = readProgress(profile.id, t.id);
    setScreen({ name: "player", title: t, season: season ?? p?.season ?? 1, episode: episode ?? p?.episode ?? 1, back: screen.name === "player" ? { name: "home" } : screen });
  };

  if (screen.name === "player") return <TvPlayer account={account} profile={profile} screen={screen} setScreen={setScreen} />;
  if (screen.name === "details") return <Details t={screen.title} tx={tx} kids={kids} max={max} inList={library.lib.list.includes(screen.title.id)} onList={() => library.toggleList(screen.title.id)} onPlay={play} onOpen={(t) => setScreen({ name: "details", title: t })} profileId={profile.id} />;

  return (
    <div className="flex h-full">
      {/* Left rail */}
      <nav
        onFocus={() => setRailOpen(true)}
        onBlur={() => setRailOpen(false)}
        className={`z-20 flex h-full shrink-0 flex-col justify-center gap-[0.4em] bg-gradient-to-r from-black via-black/90 to-transparent py-[2em] pl-[1.6em] transition-all ${railOpen ? "w-[16em]" : "w-[5.5em]"}`}
      >
        <button data-nav onClick={onSwitch} className="mb-[1.5em] flex items-center gap-[0.8em] rounded p-1 outline-none ring-white focus:ring-2">
          <Avatar index={profile.avatar} kids={kids} className="h-[2.2em] w-[2.2em] shrink-0 rounded" />
          {railOpen && <span className="truncate">{profile.name}</span>}
        </button>
        {RAIL.filter((r) => !kids || r.id !== "new").map((r) => (
          <button
            key={r.id}
            data-nav
            onClick={() => setSection(r.id)}
            className={`flex items-center gap-[0.9em] rounded px-[0.5em] py-[0.55em] text-left outline-none focus:bg-white focus:text-black ${section === r.id ? "text-white" : "text-white/55"}`}
          >
            <svg viewBox="0 0 24 24" className="h-[1.5em] w-[1.5em] shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={r.icon} /></svg>
            {railOpen && <span className="whitespace-nowrap text-[1.05em] font-semibold">{tx(r.label)}</span>}
          </button>
        ))}
        <button data-nav onClick={onSignOut} className="mt-auto flex items-center gap-[0.9em] rounded px-[0.5em] py-[0.55em] text-white/55 outline-none focus:bg-white focus:text-black">
          <svg viewBox="0 0 24 24" className="h-[1.5em] w-[1.5em] shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" /></svg>
          {railOpen && <span className="whitespace-nowrap font-semibold">{tx("Sign out")}</span>}
        </button>
      </nav>

      {/* Content */}
      <main className="relative -ml-[5.5em] h-full flex-1 overflow-y-auto overflow-x-hidden pl-[7em] [scrollbar-width:none]">
        {section === "search" ? (
          <SearchScreen tx={tx} query={query} setQuery={setQuery} results={query ? results : suggestions} onOpen={(t) => setScreen({ name: "details", title: t })} />
        ) : (
          <>
            {/* Hero follows the focused card, like TV apps do */}
            <section className="pointer-events-none fixed inset-0 -z-0">
              <Image src={img(focused.backdrop ?? focused.image, 1600, 900)} alt="" fill sizes="100vw" className="object-cover opacity-60" priority />
              <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0b] via-[#0a0a0b]/70 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0b] via-[#0a0a0b]/40 to-transparent" />
            </section>
            <div className="relative z-10 flex h-[52vh] flex-col justify-end pb-[1.5em]">
              {focused.original && <p className="text-[0.95em] font-bold tracking-[0.4em] text-white/80"><span className="font-display text-[1.6em] tracking-normal text-brand-bright">M</span> {focused.type === "series" ? "SERIES" : "FILM"}</p>}
              <h1 className="font-display text-[4.8em] leading-[0.9]">{focused.title}</h1>
              <p className="mt-[0.5em] text-[1.05em] text-white/80">
                <span className="font-semibold text-emerald-400">{focused.match}% Match</span> · {focused.year} · <span className="rounded border border-white/50 px-1 text-[0.85em]">{focused.maturity}</span> · {focused.type === "series" ? `${focused.seasons} Season${(focused.seasons ?? 1) > 1 ? "s" : ""}` : focused.runtime} · {focused.quality}
              </p>
              <p className="mt-[0.5em] line-clamp-2 max-w-[42em] text-[1.05em] text-white/80">{focused.synopsis}</p>
            </div>
            <div className="relative z-10 space-y-[1.6em] pb-[3em]">
              {rows.length === 0 && <p className="text-[1.3em] text-white/60">{section === "mylist" ? "Add titles to My List to see them here." : "Nothing here yet."}</p>}
              {rows.map((row, ri) => (
                <section key={row.id}>
                  <h2 className="mb-[0.5em] text-[1.35em] font-bold">{tx(row.title)}</h2>
                  <div className="-mx-[0.5em] flex gap-[0.7em] overflow-x-auto px-[0.5em] py-[0.6em] [scrollbar-width:none]">
                    {row.items.map((t, i) => {
                      const p = row.progress ? library.lib.progress[t.id] : undefined;
                      return (
                        <button
                          key={t.id}
                          data-nav
                          data-nav-default={ri === 0 && i === 0 ? "" : undefined}
                          onFocus={() => setFocused(t)}
                          onClick={() => setScreen({ name: "details", title: t })}
                          className="group relative aspect-video w-[15em] shrink-0 overflow-hidden rounded-md outline-none ring-white transition focus:z-10 focus:scale-110 focus:ring-[0.2em]"
                        >
                          <Image src={img(t.image, 480, 270)} alt={t.title} fill sizes="20vw" className="object-cover" />
                          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-[0.5em] text-left text-[0.9em] font-semibold">{t.title}</span>
                          {row.ranked && <span className="absolute left-[0.3em] top-[0.1em] font-display text-[2.6em] leading-none text-white drop-shadow-[0_2px_6px_rgba(0,0,0,.9)]">{i + 1}</span>}
                          {p && <span className="absolute inset-x-0 bottom-0 h-[0.25em] bg-white/30"><span className="block h-full bg-brand-bright" style={{ width: `${p.pct}%` }} /></span>}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

/* ---------------- Search ---------------- */
const KEYS = "abcdefghijklmnopqrstuvwxyz1234567890".split("");
function SearchScreen({ tx, query, setQuery, results, onOpen }: { tx: (s: string) => string; query: string; setQuery: (q: string) => void; results: Title[]; onOpen: (t: Title) => void }) {
  return (
    <div className="grid h-full grid-cols-[22em_1fr] gap-[2.5em] py-[3em] pr-[3em]">
      <div>
        <p className="mb-[0.8em] flex h-[2.4em] items-center border-b-2 border-white/40 text-[1.6em]">{query || <span className="text-white/40">{tx("Search")}</span>}</p>
        <div className="grid grid-cols-6 gap-[0.35em]">
          <button data-nav onClick={() => setQuery(query + " ")} className="col-span-3 h-[2.4em] rounded bg-white/10 outline-none focus:bg-white focus:text-black">{tx("Space")}</button>
          <button data-nav onClick={() => setQuery(query.slice(0, -1))} className="col-span-3 h-[2.4em] rounded bg-white/10 outline-none focus:bg-white focus:text-black">{tx("Delete")}</button>
          {KEYS.map((k, i) => (
            <button key={k} data-nav data-nav-default={i === 0 ? "" : undefined} onClick={() => setQuery(query + k)} className="h-[2.4em] rounded bg-white/10 text-[1.1em] font-semibold uppercase outline-none focus:bg-white focus:text-black">
              {k}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-y-auto [scrollbar-width:none]">
        <p className="mb-[0.8em] text-[1.3em] font-bold">{query ? `Results for "${query.trim()}"` : "Popular searches"}</p>
        {results.length === 0 ? (
          <p className="text-white/60">{tx("No results")}</p>
        ) : (
          <div className="grid grid-cols-4 gap-[0.8em] p-[0.4em]">
            {results.map((t) => (
              <button key={t.id} data-nav onClick={() => onOpen(t)} className="relative aspect-video overflow-hidden rounded-md outline-none ring-white transition focus:scale-105 focus:ring-[0.2em]">
                <Image src={img(t.image, 400, 225)} alt={t.title} fill sizes="20vw" className="object-cover" />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-[0.4em] text-left text-[0.85em] font-semibold">{t.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Details ---------------- */
function Details({ t, tx, kids, max, inList, onList, onPlay, onOpen, profileId }: { t: Title; tx: (s: string, ...a: (string | number)[]) => string; kids: boolean; max: Title["maturity"]; inList: boolean; onList: () => void; onPlay: (t: Title, s?: number, e?: number) => void; onOpen: (t: Title) => void; profileId: string }) {
  const [season, setSeason] = useState(1);
  const progress = readProgress(profileId, t.id);
  const eps = t.type === "series" ? episodesFor(t, season) : [];
  const more = similarTo(t, kids, max);
  return (
    <div className="relative h-full overflow-y-auto [scrollbar-width:none]">
      <div className="pointer-events-none fixed inset-0">
        <Image src={img(t.backdrop ?? t.image, 1600, 900)} alt="" fill sizes="100vw" className="object-cover opacity-50" priority />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0b] via-[#0a0a0b]/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0b] to-transparent" />
      </div>
      <div className="relative z-10 px-[6em] pb-[3em] pt-[10vh]">
        <h1 className="font-display text-[5.5em] leading-[0.9]">{t.title}</h1>
        <p className="mt-[0.6em] text-[1.1em] text-white/80">
          <span className="font-semibold text-emerald-400">{t.match}% Match</span> · {t.year} · <span className="rounded border border-white/50 px-1">{t.maturity}</span> · {t.type === "series" ? `${t.seasons} Season${(t.seasons ?? 1) > 1 ? "s" : ""}` : t.runtime} · {t.quality}
        </p>
        <p className="mt-[0.8em] max-w-[40em] text-[1.15em] text-white/85">{t.synopsis}</p>
        <p className="mt-[0.6em] max-w-[40em] text-white/60">Starring {t.cast.join(", ")} · {t.genres.join(", ")}</p>
        {t.comingSoon ? (
          <p className="mt-[1.5em] text-[1.3em] font-semibold text-brand-bright">{tx("Coming Soon")}: {t.comingSoon}</p>
        ) : (
          <div className="mt-[1.5em] flex gap-[0.8em]">
            <button data-nav data-nav-default onClick={() => onPlay(t)} className="flex items-center gap-[0.5em] rounded bg-white/20 px-[1.6em] py-[0.6em] text-[1.2em] font-bold outline-none focus:bg-white focus:text-black">
              ▶ {progress ? `${tx("Resume")}${t.type === "series" ? ` S${progress.season ?? 1}:E${progress.episode ?? 1}` : ""}` : tx("Play")}
            </button>
            <button data-nav onClick={onList} className="rounded bg-white/20 px-[1.4em] py-[0.6em] text-[1.2em] font-semibold outline-none focus:bg-white focus:text-black">
              {inList ? "✓" : "+"} {tx("My List")}
            </button>
          </div>
        )}

        {t.type === "series" && !t.comingSoon && (
          <section className="mt-[2.5em]">
            <div className="flex items-center gap-[0.6em]">
              <h2 className="mr-[0.6em] text-[1.4em] font-bold">{tx("Episodes")}</h2>
              {Array.from({ length: t.seasons ?? 1 }, (_, i) => i + 1).map((n) => (
                <button key={n} data-nav onClick={() => setSeason(n)} className={`rounded px-[0.9em] py-[0.3em] outline-none focus:bg-white focus:text-black ${n === season ? "bg-white/25" : "bg-white/5"}`}>
                  {tx("Season {0}", n)}
                </button>
              ))}
            </div>
            <div className="mt-[0.8em] flex gap-[0.8em] overflow-x-auto px-[0.3em] py-[0.6em] [scrollbar-width:none]">
              {eps.map((e) => (
                <button key={e.number} data-nav onClick={() => onPlay(t, season, e.number)} className="w-[17em] shrink-0 rounded-md bg-white/5 p-[0.7em] text-left outline-none ring-white transition focus:scale-105 focus:bg-white/15 focus:ring-[0.2em]">
                  <span className="relative mb-[0.5em] block aspect-video overflow-hidden rounded">
                    <Image src={img(t.image, 400, 225)} alt="" fill sizes="20vw" className="object-cover" />
                  </span>
                  <span className="block font-semibold">{e.number}. {e.title}</span>
                  <span className="block text-[0.85em] text-white/60">{e.runtime}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {more.length > 0 && (
          <section className="mt-[2em]">
            <h2 className="mb-[0.6em] text-[1.4em] font-bold">More Like This</h2>
            <div className="flex gap-[0.8em] overflow-x-auto px-[0.3em] py-[0.6em] [scrollbar-width:none]">
              {more.map((m) => (
                <button key={m.id} data-nav onClick={() => onOpen(m)} className="relative aspect-video w-[15em] shrink-0 overflow-hidden rounded-md outline-none ring-white transition focus:scale-110 focus:ring-[0.2em]">
                  <Image src={img(m.image, 400, 225)} alt={m.title} fill sizes="20vw" className="object-cover" />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-[0.4em] text-left text-[0.85em] font-semibold">{m.title}</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

/* ---------------- Player ---------------- */
function TvPlayer({ account, profile, screen, setScreen }: { account: Account; profile: Profile; screen: Extract<Screen, { name: "player" }>; setScreen: (s: Screen) => void }) {
  const [media, setMedia] = useState<ResolvedMedia | null>(null);
  const { title, season, episode } = screen;

  useEffect(() => {
    let cancelled = false;
    resolveMedia(title, season, episode).then((m) => !cancelled && setMedia(m));
    return () => {
      cancelled = true;
    };
  }, [title, season, episode]);

  // Remote Back key leaves the player
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Backspace" || e.key === "GoBack" || e.key === "BrowserBack" || e.keyCode === 10009 || e.keyCode === 461) {
        e.preventDefault();
        setScreen(screen.back);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen.back, setScreen]);

  if (!media) return <div className="fixed inset-0 bg-black" />;
  return (
    <Player
      key={`${title.id}-${season}-${episode}`}
      title={title}
      sources={media.sources}
      extraSubs={media.subs}
      intro={media.intro}
      season={season}
      episode={episode}
      profileId={profile.id}
      planId={account.planId ?? "standard"}
      prefs={settingsOf(profile)}
      email={account.email}
      profileName={profile.name}
      onExit={() => setScreen(screen.back)}
      onEpisode={(s, e) => setScreen({ ...screen, season: s, episode: e })}
    />
  );
}
