/**
 * Demo video sources (public HLS test streams) until titles are uploaded via the admin dashboard.
 * Each title gets a primary stream with fallbacks if one host is down.
 */
export const DEMO_STREAMS = [
  "https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8",
  "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
  "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
];

export function sourcesFor(titleIndex: number): string[] {
  const start = titleIndex % DEMO_STREAMS.length;
  return [...DEMO_STREAMS.slice(start), ...DEMO_STREAMS.slice(0, start)];
}

/** Highest resolution (video height) each plan may stream. */
export const PLAN_MAX_HEIGHT: Record<string, number> = {
  mobile: 480,
  basic: 720,
  standard: 1080,
  premium: 2160,
};

/** Mock intro window for series (seconds). */
export const INTRO = { start: 5, end: 35 };
