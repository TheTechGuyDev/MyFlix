export type PlanId = "mobile" | "basic" | "standard" | "premium" | (string & {});

export type Plan = {
  id: PlanId;
  name: string;
  price: number;
  resolution: string;
  quality: string;
  devices: string;
  screens: number;
  downloads: number;
  badge?: string;
  annualDiscount?: number;
  maxHeight?: number;
};

export const plans: Plan[] = [
  { id: "mobile", name: "Mobile", price: 1500, resolution: "480p", quality: "Fair", devices: "Phone, tablet", screens: 1, downloads: 1 },
  { id: "basic", name: "Basic", price: 2500, resolution: "720p (HD)", quality: "Good", devices: "TV, computer, phone, tablet", screens: 1, downloads: 1 },
  { id: "standard", name: "Standard", price: 4000, resolution: "1080p (Full HD)", quality: "Great", devices: "TV, computer, phone, tablet", screens: 2, downloads: 2, badge: "Most Popular" },
  { id: "premium", name: "Premium", price: 5500, resolution: "4K (Ultra HD) + HDR", quality: "Best", devices: "TV, computer, phone, tablet", screens: 4, downloads: 6 },
];

/** Plans from the database replace these defaults at start-up. */
export function applyRemotePlans(rows: (Plan & { annual_discount?: number; active?: boolean; max_height?: number })[]) {
  const list = rows.filter((p) => p.active !== false).map((p) => ({ ...p, annualDiscount: p.annual_discount ?? p.annualDiscount ?? 15, maxHeight: p.max_height }));
  if (list.length) plans.splice(0, plans.length, ...list);
}

export const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

export const annualPrice = (p: Plan) => Math.round(p.price * 12 * (1 - (p.annualDiscount ?? 15) / 100));

export const getPlan = (id?: PlanId | null) => plans.find((p) => p.id === id);
