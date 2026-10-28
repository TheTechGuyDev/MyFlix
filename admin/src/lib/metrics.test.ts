import { describe, expect, it } from "vitest";
import { cohorts, deviceSplit, hourly, overview } from "./metrics";
import { videoState, duration } from "./format";
import { defaultSettings } from "./seed";
import type { Db } from "./store";
import type { AdminStats, Member } from "./types";

const day = 864e5;
const member = (id: string, p: Partial<Member>): Member => ({
  id, name: id, email: `${id}@x.ng`, state: "Lagos", planId: "basic", status: "active", joinedAt: new Date().toISOString(), renewsAt: "", method: "card", profiles: [], devices: 0, watchHours: 0, lastActive: "", ...p,
});
const stats = (p: Partial<AdminStats> = {}): AdminStats => ({
  members_total: 3, members_active: 2, members_pending: 1, members_suspended: 0, cancelling: 0, churned_period: 1, signups_period: 3, mrr: 5000, revenue_period: 7500, refunds_period: 0,
  plan_mix: { basic: 2 }, signups_daily: [], revenue_daily: [], watch_hours_period: 12.5, watch_daily: [], top_titles: [{ id: "t1", plays: 4 }], payment_channels: { card: 2, bank_transfer: 1 },
  streams_live: 0, tickets_open: 0, hourly: [{ dow: 5, hour: 21, n: 7 }], device_kinds: { android: 3, tv: 1 }, by_state: { Lagos: 2 }, failed_period: 0, revenue_prev: 5000, signups_prev: 0, ...p,
});
const db = (p: Partial<Db> = {}): Db =>
  ({
    titles: [{ id: "t1", title: "T1", genres: ["Drama"], stats: { views: 9 } }], plans: [{ id: "basic", name: "Basic", price: 2500, resolution: "720p" }], settings: defaultSettings(), curation: { rows: [] },
    members: [], txns: [], promos: [], gifts: [], campaigns: [], tickets: [], staff: [], roles: [], audit: [], notices: [], stats: stats(), session: null, ready: true, ...p,
  }) as unknown as Db;

describe("admin metrics use real figures only", () => {
  it("takes headline numbers from the database", () => {
    const o = overview(db());
    expect(o.activeCount).toBe(2);
    expect(o.mrr).toBe(5000);
    expect(o.arpu).toBe(2500);
    expect(Math.round(o.revDelta)).toBe(50);
    expect(Math.round(o.churn)).toBe(33);
    expect(o.topTitles[0]).toMatchObject({ id: "t1", plays: 4 });
    expect(o.methodMix.find((m) => m.name === "Bank transfer")?.value).toBe(1);
  });
  it("shows zeros, not made-up numbers, when there is no data", () => {
    const o = overview(db({ stats: stats({ members_active: 0, mrr: 0, revenue_period: 0, revenue_prev: 0, top_titles: [], hourly: [], device_kinds: {} }) }));
    expect(o.activeCount).toBe(0);
    expect(o.revDelta).toBe(0);
    expect(o.topTitles).toEqual([]);
    expect(hourly(db({ stats: stats({ hourly: [] }) })).every((r) => r.hours.every((h) => h === 0))).toBe(true);
    expect(deviceSplit(db({ stats: stats({ device_kinds: {} }) }))).toEqual([]);
  });
  it("places viewing in the right day and hour", () => {
    const fri = hourly(db()).find((r) => r.day === "Fri")!;
    expect(fri.hours[21]).toBe(7);
  });
  it("cohorts count who paid and who still has access", () => {
    const now = Date.now();
    const c = cohorts(db({
      members: [
        member("a", { paidUntil: new Date(now + 5 * day).toISOString() }),
        member("b", { paidUntil: new Date(now - 5 * day).toISOString() }),
        member("c", { status: "pending" }),
      ],
    }));
    const latest = c[c.length - 1];
    expect(latest.size).toBe(3);
    expect(latest.paidPct).toBe(67);
    expect(latest.retainedPct).toBe(50);
  });
});

describe("video status labels", () => {
  it("describes Mux states", () => {
    expect(videoState(undefined).label).toBe("No video");
    expect(videoState({ provider: "mux", status: "ready", height: 2160 }).label).toBe("Ready · 4K");
    expect(videoState({ provider: "mux", status: "processing" }).tone).toBe("warn");
    expect(videoState({ provider: "mux", status: "error" }).tone).toBe("bad");
  });
  it("formats durations", () => {
    expect(duration(3725)).toBe("1h 2m");
    expect(duration(95)).toBe("1m 35s");
  });
});
