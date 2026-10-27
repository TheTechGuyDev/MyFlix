export type Maturity = "All" | "7+" | "13+" | "16+" | "18+";
export type TitleStatus = "published" | "draft" | "scheduled" | "archived";
export type RenditionLabel = "480p" | "720p" | "1080p" | "1440p" | "2160p";

export type Rendition = { label: RenditionLabel; height: number; bitrateKbps: number; durationSec: number };

/** A video attached to a movie or an episode. */
export type VideoAsset = {
  source: "upload" | "url";
  url?: string; // HLS (.m3u8) or MP4 when source = url
  mediaId?: string; // IndexedDB key when source = upload
  fileName?: string;
  sizeMB?: number;
  width?: number;
  height?: number;
  durationSec?: number;
  uploadedAt: string;
  processingStartedAt: string;
  renditions: Rendition[];
};

export type Subtitle = { id: string; lang: string; label: string; mediaId?: string; url?: string };
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

export type SubStatus = "active" | "cancelled" | "past_due" | "suspended" | "trial";

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
  method: "card" | "transfer" | "ussd";
  last4?: string;
  profiles: { name: string; kids: boolean }[];
  devices: number;
  watchHours: number;
  lastActive: string;
  source?: "web" | "demo";
  notes?: string;
};

export type Txn = {
  id: string;
  memberId: string;
  memberName: string;
  email: string;
  amount: number;
  planId: string;
  method: "card" | "transfer" | "ussd";
  status: "success" | "failed" | "refunded" | "pending";
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
};

export type GiftCard = { id: string; code: string; amount: number; balance: number; createdAt: string; redeemedBy?: string };

export type Campaign = {
  id: string;
  name: string;
  channel: "push" | "email" | "in_app" | "sms";
  audience: string;
  subject: string;
  body: string;
  titleId?: string;
  status: "draft" | "scheduled" | "sent";
  scheduledAt?: string;
  sentAt?: string;
  reach: number;
  opens: number;
  clicks: number;
  createdAt: string;
};

export type TicketMsg = { from: "member" | "staff"; author: string; body: string; at: string };
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
  passwordHash: string;
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
  geoRestrictNigeria: boolean;
  announcement: string;
};

export type Notice = { id: string; at: string; kind: "info" | "warn" | "success"; text: string; read: boolean };
