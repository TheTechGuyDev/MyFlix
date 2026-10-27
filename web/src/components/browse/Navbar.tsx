"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Logo from "@/components/landing/Logo";
import Avatar from "@/components/auth/Avatar";
import type { Profile } from "@/lib/mock-auth";
import { byId, img, type Tab } from "@/lib/catalog";
import { BellIcon, ChevronDown, CloseIcon, SearchIcon } from "./icons";

const tabs: { id: Tab; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "series", label: "Series" },
  { id: "movies", label: "Movies" },
  { id: "new", label: "New & Popular" },
  { id: "mylist", label: "My List" },
];

const notifications = [
  { id: "eko-nights", head: "New Season", body: "Eko Nights Season 2 is here", when: "Today" },
  { id: "the-lecturer", head: "New Arrival", body: "The Lecturer", when: "2 days ago" },
  { id: "after-sunset", head: "Coming Soon", body: "After Sunset arrives Friday", when: "3 days ago" },
];

type Props = {
  tab: Tab;
  onTab: (t: Tab) => void;
  query: string;
  onQuery: (q: string) => void;
  profile: Profile;
  profiles: Profile[];
  onSwitch: (p: Profile) => void;
  onSignOut: () => void;
  onOpenTitle: (id: string) => void;
};

function useClickAway(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && close();
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open, close]);
  return ref;
}

export default function Navbar({ tab, onTab, query, onQuery, profile, profiles, onSwitch, onSignOut, onOpenTitle }: Props) {
  const [solid, setSolid] = useState(false);
  const [searchOpen, setSearchOpen] = useState(Boolean(query));
  const [menu, setMenu] = useState<null | "browse" | "bell" | "profile">(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const close = () => setMenu(null);
  const browseRef = useClickAway(menu === "browse", close);
  const bellRef = useClickAway(menu === "bell", close);
  const profRef = useClickAway(menu === "profile", close);
  const searchRef = useClickAway(searchOpen && !query, () => setSearchOpen(false));

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  const visibleTabs = profile.kids ? tabs.filter((t) => t.id !== "new") : tabs;

  return (
    <header className={`fixed inset-x-0 top-0 z-40 transition-colors duration-500 ${solid ? "bg-ink" : "bg-gradient-to-b from-black/80 to-transparent"}`}>
      <nav className="flex h-16 items-center gap-4 px-4 sm:px-10 lg:h-[68px] lg:px-14">
        <Logo className="[&_span]:!text-3xl lg:[&_span]:!text-4xl" />
        {profile.kids && <span className="rounded bg-brand px-2 py-0.5 text-xs font-bold uppercase">Kids</span>}

        {/* Desktop tabs */}
        <ul className="ml-4 hidden items-center gap-5 text-sm lg:flex">
          {visibleTabs.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => onTab(t.id)}
                className={`transition ${tab === t.id && !query ? "font-semibold text-white" : "text-white/80 hover:text-white/60"}`}
              >
                {t.label}
              </button>
            </li>
          ))}
        </ul>

        {/* Mobile browse menu */}
        <div ref={browseRef} className="relative ml-1 lg:hidden">
          <button onClick={() => setMenu(menu === "browse" ? null : "browse")} className="flex items-center gap-1 text-sm font-semibold">
            Browse <ChevronDown className="h-4 w-4" />
          </button>
          {menu === "browse" && (
            <ul className="absolute left-0 top-9 w-48 border-t-2 border-white bg-black/95 py-2 text-sm">
              {visibleTabs.map((t) => (
                <li key={t.id}>
                  <button onClick={() => { onTab(t.id); close(); }} className={`block w-full px-4 py-2.5 text-left hover:bg-white/10 ${tab === t.id ? "font-semibold" : "text-white/70"}`}>
                    {t.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="ml-auto flex items-center gap-3 sm:gap-5">
          {/* Search */}
          <div ref={searchRef} className={`flex items-center ${searchOpen ? "border border-white bg-black/80" : ""}`}>
            <button onClick={() => setSearchOpen(true)} aria-label="Search" className="p-1.5">
              <SearchIcon className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
            {searchOpen && (
              <>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => onQuery(e.target.value)}
                  placeholder="Titles, people, genres"
                  className="w-32 bg-transparent py-1.5 pr-1 text-sm outline-none placeholder:text-white/60 sm:w-60"
                />
                {query && (
                  <button onClick={() => { onQuery(""); setSearchOpen(false); }} aria-label="Clear search" className="p-1.5">
                    <CloseIcon className="h-4 w-4" />
                  </button>
                )}
              </>
            )}
          </div>

          {/* Notifications */}
          <div ref={bellRef} className="relative hidden sm:block">
            <button onClick={() => setMenu(menu === "bell" ? null : "bell")} aria-label="Notifications" className="relative p-1">
              <BellIcon className="h-6 w-6" />
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold">
                {notifications.length}
              </span>
            </button>
            {menu === "bell" && (
              <ul className="absolute right-0 top-11 w-80 border-t-2 border-white bg-black/95 text-sm">
                {notifications.map((n) => {
                  const t = byId(n.id)!;
                  return (
                    <li key={n.id}>
                      <button onClick={() => { onOpenTitle(n.id); close(); }} className="flex w-full gap-3 border-b border-white/10 p-3 text-left hover:bg-white/5">
                        <span className="relative h-16 w-28 shrink-0 overflow-hidden rounded">
                          <Image src={img(t.image, 240, 135)} alt="" fill sizes="112px" className="object-cover" />
                        </span>
                        <span>
                          <span className="block font-semibold">{n.head}</span>
                          <span className="block text-white/80">{n.body}</span>
                          <span className="mt-1 block text-xs text-white/50">{n.when}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Profile menu */}
          <div ref={profRef} className="relative">
            <button onClick={() => setMenu(menu === "profile" ? null : "profile")} aria-label="Account menu" className="flex items-center gap-1.5">
              <Avatar index={profile.avatar} className="h-8 w-8 rounded" />
              <ChevronDown className={`hidden h-4 w-4 transition sm:block ${menu === "profile" ? "rotate-180" : ""}`} />
            </button>
            {menu === "profile" && (
              <div className="absolute right-0 top-12 w-60 border-t-2 border-white bg-black/95 text-sm">
                <ul className="py-2">
                  {profiles.filter((p) => p.id !== profile.id).map((p) => (
                    <li key={p.id}>
                      <button onClick={() => { onSwitch(p); close(); }} className="flex w-full items-center gap-3 px-4 py-2 text-left hover:underline">
                        <Avatar index={p.avatar} className="h-8 w-8 rounded" />
                        {p.name}
                      </button>
                    </li>
                  ))}
                  <li><Link href="/profiles" className="block px-4 py-2 hover:underline">Manage Profiles</Link></li>
                  <li><Link href="/account" className="block px-4 py-2 hover:underline">Account</Link></li>
                  <li><Link href="/#faq" className="block px-4 py-2 hover:underline">Help Centre</Link></li>
                </ul>
                <button onClick={onSignOut} className="block w-full border-t border-white/20 px-4 py-3 text-center hover:underline">
                  Sign out of MyFlix
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
