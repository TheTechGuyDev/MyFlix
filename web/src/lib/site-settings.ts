"use client";

import { getState } from "./store";

/** Platform settings published from the admin dashboard (maintenance, announcement, sign-ups). */
export type SiteSettings = {
  platformName: string;
  supportEmail: string;
  supportPhone: string;
  maintenance: boolean;
  maintenanceMessage: string;
  signupsOpen: boolean;
  announcement: string;
  downloadsEnabled: boolean;
  maxProfiles: number;
  watermarkEnabled: boolean;
  drmEnabled: boolean;
  screenshotBlock: boolean;
  streamLimitEnforced: boolean;
  smsEnabled: boolean;
  emailCodesEnabled: boolean;
  supportWhatsapp: string;
};

const defaults: SiteSettings = {
  platformName: "MyFlix",
  supportEmail: "help@myflix.ng",
  supportPhone: "",
  maintenance: false,
  maintenanceMessage: "MyFlix is getting an upgrade. We'll be back shortly.",
  signupsOpen: true,
  announcement: "",
  downloadsEnabled: true,
  maxProfiles: 5,
  watermarkEnabled: true,
  drmEnabled: true,
  screenshotBlock: true,
  streamLimitEnforced: true,
  smsEnabled: false,
  emailCodesEnabled: true,
  supportWhatsapp: "",
};

export function siteSettings(): SiteSettings {
  return { ...defaults, ...(getState().settings as Partial<SiteSettings>) };
}
