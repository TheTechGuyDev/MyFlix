"use client";

import { useT } from "@/lib/i18n";

/** Translated text for use inside server components. */
export default function T({ children }: { children: string }) {
  return <>{useT()(children)}</>;
}
