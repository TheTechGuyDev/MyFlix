export type Maturity = "All" | "7+" | "13+" | "16+" | "18+";
export type TitleStatus = "published" | "draft" | "scheduled" | "archived";


/** A video hosted on Mux, attached to a movie or an episode. */
export type VideoAsset = {
  provider: "mux";
  upload_id?: string;
  asset_id?: string;
  playback_id?: string;
  policy?: "signed" | "public";
  status: "uploading" | "processing" | "ready" | "error";
  height?: number;
  duration?: number;
  tier?: string;
  mp4?: boolean;
  fileName?: string;
  sizeMB?: number;
  updated_at?: string;
};

export type Subtitle = { id: string; lang: string; label: string; url?: string };
export type AudioTrack = { id: string; lang: string; label: string; description?: boolean };

export type Episode = {
  id: string;
  number: number;
  title: string;
  runtime: string;
  synopsis: string;
  video?: VideoAsset;
  introStart?: number;
  introEnd?: number;
};
export type Season = { number: number; episodes: Episode[] };

export type Title = {
  id: string;
  title: string;
  image: string; // Unsplash id, http(s) URL or data: URL
  backdrop?: string;
  type: "movie" | "series";
  year: number;
  maturity: Maturity;
  genres: string[];
  runtime?: string;
  seasons?: number;
  synopsis: string;
  cast: string[];
  directors?: string[];
  tags: string[];
  match: number;
  original?: boolean;
  kids?: boolean;
  isNew?: boolean;
  comingSoon?: string;
  quality: "HD" | "4K";
  // admin-only
  status: TitleStatus;
  releaseAt?: string;
  expiresAt?: string;
  languages?: string[];
  video?: VideoAsset;
  seasonsData?: Season[];
  subtitles?: Subtitle[];
  audioTracks?: AudioTrack[];
  introStart?: number;
  introEnd?: number;
  licence?: { owner: string; type: "Original" | "Licensed" | "Co-production"; expires?: string; cost?: number };
  stats: { views: number; watchHours: number; completion: number; likes: number; trend: number[] };
  sample?: boolean;
  addedAt: string;
  updatedAt: string;
};

export type Plan = {
  id: string;
  name: string;
  price: number;
  resolution: string;
  quality: string;
  devices: string;
  screens: number;
  downloads: number;
  badge?: string;
  active: boolean;
  adSupported?: boolean;
  annualDiscount?: number;
};

export type SubStatus = "active" | "cancelled" | "past_due" | "suspended" | "trial" | "pending";

export type Member = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  state: string;
  planId: string;
  status: SubStatus;
  joinedAt: string;
  renewsAt: string;
  method: "card" | "transfer" | "ussd" | "bank" | "credit";
  last4?: string;
  profiles: { name: string; kids: boolean }[];
  paidUntil?: string;
  cancelAt?: string;
  credit?: number;
  billingCycle?: string;
  referralCode?: string;
  referredBy?: string;
  devices: number;
  watchHours: number;
  lastActive: string;
  notes?: string;
};

export type Txn = {
  id: string;
  memberId: string;
  memberName: string;
  email: string;
  amount: number;
  planId: string;
  method: "card" | "transfer" | "ussd" | "bank" | "credit";
  status: "success" | "failed" | "refunded" | "pending" | "abandoned";
  kind?: string;
  at: string;
  reference: string;
};

export type Promo = {
  id: string;
  code: string;
  kind: "percent" | "amount" | "free_months";
  value: number;
  plans: string[];
  maxUses: number;
  used: number;
  expiresAt?: string;
  active: boolean;
  createdAt: string;
  label?: string;
  firstPaymentOnly?: boolean;
};

export type GiftCard = { id: string; code: string; amount: number; balance: number; createdAt: string; redeemedBy?: string; redeemedAt?: string; note?: string };

export type Campaign = {
  id: string;
  name: string;
  channel: "push" | "email" | "in_app" | "sms";
  audience: string;
  subject: string;
  body: string;
  titleId?: string;
  status: "draft" | "scheduled" | "sending" | "sent" | "failed";
  scheduledAt?: string;
  sentAt?: string;
  reach: number;
  opens: number;
  clicks: number;
  createdAt: string;
};

export type TicketMsg = { id?: number; from: "member" | "staff"; author: string; body: string; at: string; internal?: boolean };
export type Ticket = {
  id: string;
  subject: string;
  memberId: string;
  memberName: string;
  email: string;
  category: "Billing" | "Playback" | "Account" | "Content" | "Other";
  priority: "low" | "normal" | "high" | "urgent";
  status: "open" | "pending" | "resolved";
  assignee?: string;
  messages: TicketMsg[];
  createdAt: string;
  updatedAt: string;
};

export type Section =
  | "overview"
  | "content"
  | "uploads"
  | "curation"
  | "calendar"
  | "users"
  | "plans"
  | "payments"
  | "analytics"
  | "campaigns"
  | "support"
  | "staff"
  | "audit"
  | "settings";

export type Role = { id: string; name: string; permissions: Section[]; system?: boolean };

export type Staff = {
  id: string;
  name: string;
  email: string;
  roleId: string;
  active: boolean;
  lastLogin?: string;
  createdAt: string;
  avatar: number;
};

export type AuditEntry = { id: string; at: string; staff: string; action: string; target: string };

export type Curation = {
  heroHome?: string;
  heroSeries?: string;
  heroMovies?: string;
  heroKids?: string;
  rows: { id: string; title: string; titleIds: string[]; enabled: boolean }[];
  top10?: string[];
  clips?: { id: string; titleId: string; start: number; end: number; caption: string }[];
};

export type Settings = {
  platformName: string;
  supportEmail: string;
  supportPhone: string;
  maintenance: boolean;
  maintenanceMessage: string;
  signupsOpen: boolean;
  freeTrialDays: number;
  defaultLanguage: string;
  maxProfiles: number;
  paystackPublicKey: string;
  paystackSecretSet: boolean;
  flutterwaveEnabled: boolean;
  ussdEnabled: boolean;
  transferEnabled: boolean;
  downloadsEnabled: boolean;
  maxDownloadsPerDevice: number;
  downloadExpiryDays: number;
  dataSaverDefault: boolean;
  watermarkEnabled: boolean;
  drmEnabled: boolean;
  screenshotBlock: boolean;
  streamLimitEnforced: boolean;
  geoRestrictNigeria: boolean;
  announcement: string;
  supportWhatsapp: string;
  smsEnabled: boolean;
  emailCodesEnabled: boolean;
  staffSessionMinutes: number;
};

export type AdminStats = {
  members_total: number;
  members_active: number;
  members_pending: number;
  members_suspended: number;
  cancelling: number;
  churned_period: number;
  signups_period: number;
  mrr: number;
  revenue_period: number;
  refunds_period: number;
  plan_mix: Record<string, number>;
  signups_daily: { day: string; n: number }[];
  revenue_daily: { day: string; amount: number }[];
  watch_hours_period: number;
  watch_daily: { day: string; hours: number }[];
  top_titles: { id: string; plays: number }[];
  payment_channels: Record<string, number>;
  streams_live: number;
  tickets_open: number;
  hourly: { dow: number; hour: number; n: number }[];
  device_kinds: Record<string, number>;
  by_state: Record<string, number>;
  failed_period: number;
  revenue_prev: number;
  signups_prev: number;
};

export type Notice = { id: string; at: string; kind: "info" | "warn" | "success"; text: string; read: boolean };
