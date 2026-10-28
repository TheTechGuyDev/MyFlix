import seed from "@/data/seed.json";
import type { Settings, Title } from "./types";

export const STATES = ["Lagos", "Abuja (FCT)", "Rivers", "Oyo", "Kano", "Enugu", "Anambra", "Delta", "Kaduna", "Ogun", "Edo", "Akwa Ibom", "Plateau", "Kwara", "Imo", "Osun", "Cross River", "Abia", "Ondo", "Benue"];

/** Sample titles for testing (Settings > Sample catalogue). They play a demo clip and are marked "sample". */
export function sampleTitles(): Title[] {
  const now = new Date().toISOString();
  return (seed.titles as unknown as Title[])
    .filter((t) => !t.comingSoon)
    .map((t) => ({
      ...t,
      status: "published",
      sample: true,
      subtitles: [],
      audioTracks: [],
      stats: { views: 0, watchHours: 0, completion: 0, likes: 0, trend: [] },
      addedAt: now,
      updatedAt: now,
    }) as Title);
}

export function defaultSettings(): Settings {
  return {
    platformName: "MyFlix",
    supportEmail: "help@myflix.ng",
    supportPhone: "",
    supportWhatsapp: "",
    maintenance: false,
    maintenanceMessage: "MyFlix is getting an upgrade. We'll be back shortly.",
    signupsOpen: true,
    freeTrialDays: 0,
    defaultLanguage: "English",
    maxProfiles: 5,
    paystackPublicKey: "",
    paystackSecretSet: false,
    flutterwaveEnabled: false,
    ussdEnabled: true,
    transferEnabled: true,
    downloadsEnabled: true,
    maxDownloadsPerDevice: 25,
    downloadExpiryDays: 30,
    dataSaverDefault: false,
    watermarkEnabled: true,
    drmEnabled: false,
    screenshotBlock: true,
    streamLimitEnforced: true,
    geoRestrictNigeria: false,
    announcement: "",
    smsEnabled: false,
    emailCodesEnabled: true,
    staffSessionMinutes: 30,
  };
}
