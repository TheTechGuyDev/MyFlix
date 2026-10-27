"use client";

import {
  BarChart3, Bell, Radio, CalendarDays, ChevronsLeft, ClipboardList, CreditCard, ExternalLink, Film, LayoutDashboard, LayoutGrid, LifeBuoy, LogOut, Megaphone, Menu, Moon, Search, Settings, ShieldCheck, Sun, Tags, UploadCloud, Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { allMembers, can, currentStaff, ensureStaff, logout, markNoticesRead, roleOf, useDb } from "@/lib/store";
import type { Section } from "@/lib/types";
import { ago, img } from "@/lib/format";
import { Avatar, Badge, ToastProvider, cx } from "./ui";

export const NAV: { href: string; label: string; section: Section; icon: typeof Film; group: string }[] = [
  { href: "/", label: "Overview", section: "overview", icon: LayoutDashboard, group: "Main" },
  { href: "/analytics", label: "Analytics", section: "analytics", icon: BarChart3, group: "Main" },
  { href: "/live", label: "Live Now", section: "analytics", icon: Radio, group: "Main" },
  { href: "/content", label: "Content Library", section: "content", icon: Film, group: "Content" },
  { href: "/uploads", label: "Uploads & Encoding", section: "uploads", icon: UploadCloud, group: "Content" },
  { href: "/curation", label: "Home Curation", section: "curation", icon: LayoutGrid, group: "Content" },
  { href: "/calendar", label: "Release Calendar", section: "calendar", icon: CalendarDays, group: "Content" },
  { href: "/users", label: "Members", section: "users", icon: Users, group: "Business" },
  { href: "/plans", label: "Plans & Promos", section: "plans", icon: Tags, group: "Business" },
  { href: "/payments", label: "Payments", section: "payments", icon: CreditCard, group: "Business" },
  { href: "/campaigns", label: "Campaigns", section: "campaigns", icon: Megaphone, group: "Engagement" },
  { href: "/support", label: "Support", section: "support", icon: LifeBuoy, group: "Engagement" },
  { href: "/staff", label: "Staff & Roles", section: "staff", icon: ShieldCheck, group: "System" },
  { href: "/audit", label: "Audit Log", section: "audit", icon: ClipboardList, group: "System" },
  { href: "/settings", label: "Settings", section: "settings", icon: Settings, group: "System" },
];

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "/MyFlix/";

export default function Shell({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <Inner>{children}</Inner>
    </ToastProvider>
  );
}

function Inner({ children }: { children: ReactNode }) {
  const router = useRouter();
  const path = (usePathname() || "/").replace(/\/$/, "") || "/";
  const staff = useDb((d) => currentStaff(d));
  const role = useDb((d) => roleOf(currentStaff(d), d));
  const ready = useDb((d) => d.titles.length > 0);
  const notices = useDb((d) => d.notices);
  const openTickets = useDb((d) => d.tickets.filter((t) => t.status === "open").length);
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [dark, setDark] = useState(false);
  const [bell, setBell] = useState(false);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    ensureStaff();
    setDark(document.documentElement.classList.contains("dark"));
    try {
      setCollapsed(localStorage.getItem("myflix.admin.collapsed") === "1");
    } catch {}
  }, []);

  useEffect(() => {
    if (ready && !staff) router.replace("/login");
  }, [ready, staff, router]);

  useEffect(() => setMobile(false), [path]);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("myflix.admin.theme", next ? "dark" : "light");
    } catch {}
  };
  const toggleCollapse = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("myflix.admin.collapsed", c ? "0" : "1");
      } catch {}
      return !c;
    });
  };

  if (!ready || !staff) return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Loading MyFlix Admin…</div>;

  const current = NAV.find((n) => (n.href === "/" ? path === "/" : path.startsWith(n.href)));
  const allowed = !current || can(current.section);
  const unread = notices.filter((n) => !n.read).length;
  const groups = [...new Set(NAV.map((n) => n.group))];

  const sidebar = (
    <nav className="flex h-full flex-col">
      <div className={cx("flex items-center gap-2 px-4 pb-4 pt-5", collapsed && "justify-center px-2")}>
        <span className="font-display text-3xl leading-none tracking-wide">
          <span>MY</span>
          <span className="text-brand">FLIX</span>
        </span>
        {!collapsed && <Badge tone="brand">Admin</Badge>}
      </div>
      <div className="thin-scroll flex-1 space-y-4 overflow-y-auto px-3 pb-4">
        {groups.map((g) => {
          const items = NAV.filter((n) => n.group === g && role?.permissions.includes(n.section));
          if (!items.length) return null;
          return (
            <div key={g}>
              {!collapsed && <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">{g}</p>}
              <ul className="space-y-0.5">
                {items.map((n) => {
                  const on = current?.href === n.href;
                  const Icon = n.icon;
                  return (
                    <li key={n.href}>
                      <Link
                        href={n.href}
                        title={collapsed ? n.label : undefined}
                        className={cx(
                          "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                          collapsed && "justify-center px-2",
                          on ? "bg-brand text-white shadow-md shadow-brand/30" : "text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-white/10",
                        )}
                      >
                        <Icon size={18} />
                        {!collapsed && <span className="flex-1">{n.label}</span>}
                        {!collapsed && n.section === "support" && openTickets > 0 && <span className={cx("rounded-full px-1.5 text-[10px] font-bold", on ? "bg-white/25" : "bg-danger text-white")}>{openTickets}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
      <button onClick={toggleCollapse} className="m-3 hidden items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold text-slate-500 hover:bg-white/70 lg:flex dark:hover:bg-white/10">
        <ChevronsLeft size={16} className={cx("transition", collapsed && "rotate-180")} />
        {!collapsed && "Collapse"}
      </button>
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <aside className={cx("glass sticky top-3 m-3 hidden h-[calc(100vh-1.5rem)] shrink-0 rounded-2xl transition-all lg:block", collapsed ? "w-[76px]" : "w-64")}>{sidebar}</aside>
      {mobile && (
        <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden" onClick={() => setMobile(false)}>
          <aside className="glass absolute inset-y-3 left-3 w-64 rounded-2xl !bg-white/95 dark:!bg-[#0e1513]/95" onClick={(e) => e.stopPropagation()}>{sidebar}</aside>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="glass sticky top-3 z-30 m-3 flex h-14 items-center gap-2 rounded-2xl px-3 lg:ml-0">
          <button className="rounded-lg p-2 lg:hidden" onClick={() => setMobile(true)} aria-label="Open menu"><Menu size={20} /></button>
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-1">
            <a href={SITE} target="_blank" rel="noreferrer" className="hidden items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-white/70 sm:flex dark:text-slate-300 dark:hover:bg-white/10">
              View site <ExternalLink size={14} />
            </a>
            <button onClick={toggleTheme} aria-label="Toggle theme" className="rounded-xl p-2 hover:bg-white/70 dark:hover:bg-white/10">{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
            <div className="relative">
              <button onClick={() => { setBell(!bell); setMenu(false); }} aria-label="Notifications" className="relative rounded-xl p-2 hover:bg-white/70 dark:hover:bg-white/10">
                <Bell size={18} />
                {unread > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-danger" />}
              </button>
              {bell && (
                <div className="glass absolute right-0 top-12 w-80 rounded-2xl !bg-white/95 p-2 dark:!bg-[#0e1513]/95">
                  <div className="flex items-center justify-between px-2 py-1.5">
                    <p className="text-sm font-semibold">Notifications</p>
                    <button className="text-xs font-semibold text-brand" onClick={markNoticesRead}>Mark all read</button>
                  </div>
                  <ul className="thin-scroll max-h-80 overflow-y-auto">
                    {notices.length === 0 && <li className="p-4 text-center text-sm text-slate-500">All caught up.</li>}
                    {notices.map((n) => (
                      <li key={n.id} className="flex gap-2 rounded-xl px-2 py-2 hover:bg-slate-900/5 dark:hover:bg-white/5">
                        <span className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-transparent" : n.kind === "warn" ? "bg-warn" : n.kind === "success" ? "bg-brand" : "bg-info")} />
                        <span className="text-sm">
                          {n.text}
                          <span className="block text-xs text-slate-500">{ago(n.at)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="relative">
              <button onClick={() => { setMenu(!menu); setBell(false); }} className="flex items-center gap-2 rounded-xl py-1 pl-1 pr-2 hover:bg-white/70 dark:hover:bg-white/10">
                <Avatar name={staff.name} index={staff.avatar} />
                <span className="hidden text-left text-xs leading-tight sm:block">
                  <span className="block font-semibold">{staff.name}</span>
                  <span className="block text-slate-500">{role?.name}</span>
                </span>
              </button>
              {menu && (
                <div className="glass absolute right-0 top-12 w-56 rounded-2xl !bg-white/95 p-2 text-sm dark:!bg-[#0e1513]/95">
                  <p className="truncate px-3 py-2 text-xs text-slate-500">{staff.email}</p>
                  {can("settings") && <Link href="/settings" className="block rounded-xl px-3 py-2 hover:bg-slate-900/5 dark:hover:bg-white/5">Settings</Link>}
                  <a href={SITE} target="_blank" rel="noreferrer" className="block rounded-xl px-3 py-2 hover:bg-slate-900/5 dark:hover:bg-white/5">Open MyFlix</a>
                  <button
                    onClick={() => {
                      logout();
                      router.replace("/login");
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-danger hover:bg-slate-900/5 dark:hover:bg-white/5"
                  >
                    <LogOut size={15} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="px-3 pb-10 pt-3 sm:px-5 lg:pl-2 lg:pr-6">
          {allowed ? children : (
            <div className="glass mx-auto mt-20 max-w-md rounded-2xl p-8 text-center">
              <ShieldCheck className="mx-auto text-slate-400" size={40} />
              <p className="mt-3 font-semibold">You don&apos;t have access to this section</p>
              <p className="mt-1 text-sm text-slate-500">Ask a Super Admin to update your role.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const titles = useDb((d) => d.titles);
  const members = useDb((d) => (can("users", d) ? allMembers(d) : []));
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return { t: [], m: [] };
    return {
      t: can("content") ? titles.filter((t) => t.title.toLowerCase().includes(s)).slice(0, 5) : [],
      m: members.filter((m) => m.name.toLowerCase().includes(s) || m.email.includes(s)).slice(0, 5),
    };
  }, [q, titles, members]);

  return (
    <div className="relative w-full max-w-md">
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search titles, members…"
        className="h-10 w-full rounded-xl bg-slate-900/5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-brand/30 dark:bg-white/5"
      />
      {open && (results.t.length > 0 || results.m.length > 0) && (
        <div className="glass absolute left-0 right-0 top-12 rounded-2xl !bg-white/95 p-2 dark:!bg-[#0e1513]/95">
          {results.t.length > 0 && <p className="px-2 pt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Titles</p>}
          {results.t.map((t) => (
            <button key={t.id} onMouseDown={() => router.push(`/content/edit?id=${t.id}`)} className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left text-sm hover:bg-slate-900/5 dark:hover:bg-white/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img(t.image, 80, 120)} alt="" className="h-9 w-6 rounded object-cover" />
              {t.title}
              <Badge>{t.type}</Badge>
            </button>
          ))}
          {results.m.length > 0 && <p className="px-2 pt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Members</p>}
          {results.m.map((m) => (
            <button key={m.id} onMouseDown={() => router.push(`/users?id=${encodeURIComponent(m.id)}`)} className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left text-sm hover:bg-slate-900/5 dark:hover:bg-white/5">
              <Avatar name={m.name} size={24} />
              <span className="flex-1 truncate">{m.name}</span>
              <span className="truncate text-xs text-slate-500">{m.email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
