import seed from "@/data/seed.json";
import type { Campaign, Curation, GiftCard, Member, Plan, Promo, Role, Settings, Staff, Ticket, Title, Txn } from "./types";

/** Deterministic random so demo data is stable across reloads. */
export function rng(seedNum: number) {
  let a = seedNum >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ["Adaeze", "Tunde", "Chinedu", "Aisha", "Bola", "Emeka", "Ngozi", "Ifeoma", "Yusuf", "Kemi", "Segun", "Halima", "Uche", "Funke", "Ibrahim", "Zainab", "Tobi", "Chiamaka", "Musa", "Temitope", "Obinna", "Hauwa", "Femi", "Amaka", "Kelechi", "Sade", "Abdul", "Folake", "Ikenna", "Ruth", "David", "Grace", "Daniel", "Blessing", "Samuel", "Joy", "Victor", "Esther", "Michael", "Mercy"];
const LAST = ["Okafor", "Adeyemi", "Bello", "Eze", "Ogunleye", "Nwosu", "Abubakar", "Okeke", "Balogun", "Ibrahim", "Afolabi", "Chukwu", "Danjuma", "Lawal", "Obi", "Adebayo", "Musa", "Onyeka", "Salami", "Umeh", "Bassey", "Etim", "Yakubu", "Olatunji", "Nnaji"];
export const STATES = ["Lagos", "Abuja (FCT)", "Rivers", "Oyo", "Kano", "Enugu", "Anambra", "Delta", "Kaduna", "Ogun", "Edo", "Akwa Ibom", "Plateau", "Kwara", "Imo", "Osun", "Cross River", "Abia", "Ondo", "Benue"];
const STATE_W = [26, 14, 9, 7, 6, 5, 5, 4, 4, 4, 3, 3, 2, 2, 2, 2, 2, 1, 1, 1];

const pick = <T,>(r: () => number, a: T[]) => a[Math.floor(r() * a.length)];
const weighted = <T,>(r: () => number, a: T[], w: number[]) => {
  const total = w.reduce((x, y) => x + y, 0);
  let n = r() * total;
  for (let i = 0; i < a.length; i++) {
    n -= w[i];
    if (n <= 0) return a[i];
  }
  return a[a.length - 1];
};
const iso = (d: Date) => d.toISOString();
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5);

export function seedTitles(): Title[] {
  const r = rng(42);
  return (seed.titles as unknown as Title[]).map((t, i) => {
    const views = Math.round((t.match - 70) * 1800 + r() * 25000 + (t.original ? 30000 : 0));
    const trend = Array.from({ length: 14 }, (_, d) => Math.round((views / 60) * (0.6 + r() * 0.8) * (1 + d / 20)));
    return {
      ...t,
      status: t.comingSoon ? "scheduled" : "published",
      releaseAt: t.comingSoon ? iso(new Date(Date.now() + (3 + i % 9) * 864e5)) : iso(daysAgo(20 + ((i * 37) % 400))),
      languages: ["English", ...(t.genres.includes("Nollywood") ? ["Yorùbá", "Pidgin"] : [])],
      subtitles: [
        { id: `${t.id}-en`, lang: "en", label: "English" },
        ...(t.genres.includes("Nollywood") ? [{ id: `${t.id}-yo`, lang: "yo", label: "Yorùbá" }, { id: `${t.id}-pcm`, lang: "pcm", label: "Pidgin" }] : []),
      ],
      audioTracks: [{ id: `${t.id}-a1`, lang: "en", label: "English (Original)" }],
      introStart: t.type === "series" ? 5 : undefined,
      introEnd: t.type === "series" ? 35 : undefined,
      licence: t.original
        ? { owner: "MyFlix Studios", type: "Original" }
        : { owner: pick(r, ["Ebony Reels Ltd", "Lagos Light Pictures", "Northbridge Media", "Afrocine Distribution"]), type: "Licensed", expires: iso(new Date(Date.now() + (60 + Math.floor(r() * 700)) * 864e5)), cost: Math.round(2 + r() * 18) * 1_000_000 },
      stats: t.comingSoon ? { views: 0, watchHours: 0, completion: 0, likes: 0, trend: Array(14).fill(0) } : { views, watchHours: Math.round(views * (t.type === "series" ? 4.2 : 1.5)), completion: Math.round(52 + r() * 40), likes: Math.round(views * (0.08 + r() * 0.1)), trend },
      addedAt: iso(daysAgo(30 + ((i * 53) % 500))),
      updatedAt: iso(daysAgo((i * 7) % 30)),
    } as Title;
  });
}

export function seedPlans(): Plan[] {
  return (seed.plans as unknown as Plan[]).map((p) => ({ ...p, active: true, annualDiscount: 15 }));
}

export function seedMembers(): Member[] {
  const r = rng(7);
  const plans = ["mobile", "basic", "standard", "premium"];
  const planW = [34, 24, 28, 14];
  return Array.from({ length: 240 }, (_, i) => {
    const first = pick(r, FIRST);
    const last = pick(r, LAST);
    const joined = daysAgo(Math.floor(r() * 365));
    const roll = r();
    const status = roll < 0.78 ? "active" : roll < 0.88 ? "cancelled" : roll < 0.95 ? "past_due" : roll < 0.98 ? "trial" : "suspended";
    const renews = new Date(joined);
    while (renews < new Date()) renews.setMonth(renews.getMonth() + 1);
    const kids = r() < 0.35;
    const method = weighted(r, ["card", "transfer", "ussd"] as const, [62, 24, 14]);
    return {
      id: `m${(1000 + i).toString()}`,
      name: `${first} ${last}`,
      email: `${first}.${last}${i}`.toLowerCase().replace(/[^a-z0-9.]/g, "") + "@" + pick(r, ["gmail.com", "yahoo.com", "outlook.com", "icloud.com"]),
      phone: `0${pick(r, ["803", "806", "813", "816", "703", "706", "802", "808", "905", "901"])}${Math.floor(1e6 + r() * 8.99e6)}`,
      state: weighted(r, STATES, STATE_W),
      planId: weighted(r, plans, planW),
      status,
      joinedAt: iso(joined),
      renewsAt: iso(renews),
      method,
      last4: method === "card" ? String(Math.floor(1000 + r() * 8999)) : undefined,
      profiles: [{ name: first, kids: false }, ...(r() < 0.6 ? [{ name: pick(r, FIRST), kids: false }] : []), ...(kids ? [{ name: "Kids", kids: true }] : [])],
      devices: 1 + Math.floor(r() * 4),
      watchHours: Math.round(r() * 180),
      lastActive: iso(daysAgo(Math.floor(r() * (status === "active" ? 7 : 60)))),
      source: "demo",
    } as Member;
  });
}

export function seedTxns(members: Member[], plans: Plan[]): Txn[] {
  const r = rng(99);
  const price = (id: string) => plans.find((p) => p.id === id)?.price ?? 0;
  const out: Txn[] = [];
  for (const m of members) {
    if (m.status === "trial") continue;
    const d = new Date(m.joinedAt);
    let n = 0;
    while (d < new Date()) {
      const failed = r() < 0.05;
      out.push({
        id: `t${m.id}-${n}`,
        memberId: m.id,
        memberName: m.name,
        email: m.email,
        amount: price(m.planId),
        planId: m.planId,
        method: m.method,
        status: failed ? "failed" : r() < 0.01 ? "refunded" : "success",
        at: iso(d),
        reference: `PSK_${Math.floor(r() * 1e10).toString(36).toUpperCase()}`,
      });
      if (m.status === "cancelled" && r() < 0.25) break;
      d.setMonth(d.getMonth() + 1);
      n++;
    }
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

export function seedRoles(): Role[] {
  return [
    { id: "super_admin", name: "Super Admin", system: true, permissions: ["overview", "content", "uploads", "curation", "calendar", "users", "plans", "payments", "analytics", "campaigns", "support", "staff", "audit", "settings"] },
    { id: "content_manager", name: "Content Manager", permissions: ["overview", "content", "uploads", "curation", "calendar", "analytics"] },
    { id: "support", name: "Customer Support", permissions: ["overview", "users", "support", "campaigns"] },
    { id: "finance", name: "Finance", permissions: ["overview", "payments", "plans", "analytics", "users"] },
    { id: "marketing", name: "Marketing", permissions: ["overview", "campaigns", "curation", "analytics", "plans"] },
  ];
}

export const DEMO_PASSWORD = "MyFlix@2026";

export function seedStaff(hash: string): Staff[] {
  const now = iso(new Date());
  return [
    { id: "s1", name: "Platform Owner", email: "admin@myflix.ng", passwordHash: hash, roleId: "super_admin", active: true, createdAt: now, avatar: 0 },
    { id: "s2", name: "Kemi Lawal", email: "content@myflix.ng", passwordHash: hash, roleId: "content_manager", active: true, createdAt: now, avatar: 2 },
    { id: "s3", name: "Ifeanyi Obi", email: "support@myflix.ng", passwordHash: hash, roleId: "support", active: true, createdAt: now, avatar: 1 },
    { id: "s4", name: "Hauwa Sani", email: "finance@myflix.ng", passwordHash: hash, roleId: "finance", active: true, createdAt: now, avatar: 3 },
  ];
}

export function seedPromos(): Promo[] {
  return [
    { id: "p1", code: "WELCOME50", kind: "percent", value: 50, plans: ["basic", "standard", "premium"], maxUses: 5000, used: 1284, expiresAt: iso(new Date(Date.now() + 40 * 864e5)), active: true, createdAt: iso(daysAgo(30)) },
    { id: "p2", code: "DETTY2026", kind: "free_months", value: 1, plans: ["premium"], maxUses: 1000, used: 211, expiresAt: iso(new Date(Date.now() + 70 * 864e5)), active: true, createdAt: iso(daysAgo(10)) },
    { id: "p3", code: "STUDENT", kind: "amount", value: 500, plans: ["mobile", "basic"], maxUses: 20000, used: 6403, active: true, createdAt: iso(daysAgo(120)) },
  ];
}

export function seedGiftCards(): GiftCard[] {
  const r = rng(5);
  return Array.from({ length: 6 }, (_, i) => {
    const amount = pick(r, [5000, 10000, 15000, 25000]);
    return { id: `g${i}`, code: `MYF-${Math.floor(r() * 1e8).toString(36).toUpperCase().padStart(6, "X")}`, amount, balance: i < 3 ? 0 : amount, createdAt: iso(daysAgo(i * 9)), redeemedBy: i < 3 ? "Adaeze Okafor" : undefined };
  });
}

export function seedCampaigns(): Campaign[] {
  return [
    { id: "c1", name: "Eko Nights S2 launch", channel: "push", audience: "All active members", subject: "Eko Nights Season 2 is here", body: "The ride continues. Stream all episodes now.", titleId: "eko-nights", status: "sent", sentAt: iso(daysAgo(2)), reach: 18420, opens: 9120, clicks: 4210, createdAt: iso(daysAgo(3)) },
    { id: "c2", name: "Win-back October", channel: "email", audience: "Cancelled in last 90 days", subject: "We miss you: 50% off your next month", body: "Come back to MyFlix with WELCOME50.", status: "sent", sentAt: iso(daysAgo(9)), reach: 3120, opens: 1412, clicks: 388, createdAt: iso(daysAgo(10)) },
    { id: "c3", name: "After Sunset reminder", channel: "push", audience: "Romance fans", subject: "After Sunset arrives Friday", body: "Tap Remind Me so you don't miss it.", titleId: "after-sunset", status: "scheduled", scheduledAt: iso(new Date(Date.now() + 3 * 864e5)), reach: 0, opens: 0, clicks: 0, createdAt: iso(daysAgo(1)) },
  ];
}

export function seedTickets(members: Member[]): Ticket[] {
  const r = rng(11);
  const topics: [Ticket["category"], string, string][] = [
    ["Billing", "Charged twice this month", "Hello, I was debited twice for my Standard plan on my GTBank card. Please help."],
    ["Playback", "Video keeps buffering", "Eko Nights keeps buffering on my Samsung TV even though my network is fine."],
    ["Account", "Can't sign in on new phone", "I changed my phone and the app says incorrect password but I reset it already."],
    ["Content", "Request: more Hausa titles", "Please add more Kannywood movies with Hausa audio."],
    ["Billing", "USSD payment not reflecting", "I paid with *737# but my account still says payment failed."],
    ["Playback", "No subtitles on Queen of Balogun", "Yoruba subtitles are not showing on episode 3."],
    ["Account", "Remove my ex from devices", "How do I sign someone out of my account?"],
    ["Other", "Gift card not working", "My gift card MYF-8KQ2 says invalid."],
  ];
  return topics.map(([category, subject, body], i) => {
    const m = members[Math.floor(r() * members.length)];
    const created = daysAgo(i * 0.7);
    const status: Ticket["status"] = i < 4 ? "open" : i < 6 ? "pending" : "resolved";
    return {
      id: `TCK-${1040 + i}`,
      subject,
      memberId: m.id,
      memberName: m.name,
      email: m.email,
      category,
      priority: i === 0 || i === 4 ? "high" : i === 1 ? "urgent" : "normal",
      status,
      assignee: status === "open" ? undefined : "Ifeanyi Obi",
      messages: [
        { from: "member", author: m.name, body, at: iso(created) },
        ...(status !== "open" ? [{ from: "staff" as const, author: "Ifeanyi Obi", body: "Thanks for reaching out. We're looking into this now and will update you shortly.", at: iso(new Date(created.getTime() + 36e5)) }] : []),
      ],
      createdAt: iso(created),
      updatedAt: iso(created),
    };
  });
}

export function seedCuration(titles: Title[]): Curation {
  const byGenre = (g: string) => titles.filter((t) => t.genres.includes(g) && t.status === "published").map((t) => t.id);
  return {
    heroHome: "eko-nights",
    heroSeries: "queen-of-balogun",
    heroMovies: "third-mainland",
    heroKids: "compound-kids",
    rows: [
      { id: "r-naija", title: "Made in Naija", titleIds: byGenre("Nollywood").slice(0, 10), enabled: true },
      { id: "r-weekend", title: "Weekend Binge", titleIds: titles.filter((t) => t.type === "series" && t.status === "published").slice(0, 8).map((t) => t.id), enabled: true },
    ],
  };
}

export function seedSettings(): Settings {
  return {
    platformName: "MyFlix",
    supportEmail: "help@myflix.ng",
    supportPhone: "0800 000 0000",
    maintenance: false,
    maintenanceMessage: "MyFlix is getting an upgrade. We'll be back shortly.",
    signupsOpen: true,
    freeTrialDays: 0,
    defaultLanguage: "English",
    maxProfiles: 5,
    paystackPublicKey: "pk_test_xxxxxxxxxxxxxxxx",
    paystackSecretSet: false,
    flutterwaveEnabled: false,
    ussdEnabled: true,
    transferEnabled: true,
    downloadsEnabled: true,
    maxDownloadsPerDevice: 25,
    downloadExpiryDays: 30,
    dataSaverDefault: false,
    watermarkEnabled: false,
    drmEnabled: false,
    geoRestrictNigeria: false,
    announcement: "",
  };
}
