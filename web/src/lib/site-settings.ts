"use client";

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
};

const defaults: SiteSettings = {
  platformName: "MyFlix",
  supportEmail: "help@myflix.ng",
  supportPhone: "0800 000 0000",
  maintenance: false,
  maintenanceMessage: "MyFlix is getting an upgrade. We'll be back shortly.",
  signupsOpen: true,
  announcement: "",
  downloadsEnabled: true,
  maxProfiles: 5,
};

export function siteSettings(): SiteSettings {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem("myflix.admin.settings");
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch {
    return defaults;
  }
}
