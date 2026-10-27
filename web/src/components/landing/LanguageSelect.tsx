"use client";

import { useState } from "react";
import { languages } from "@/lib/landing-data";

export default function LanguageSelect({ compact = false }: { compact?: boolean }) {
  const [lang, setLang] = useState(languages[0]);

  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">Choose a language</span>
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="pointer-events-none absolute left-3 h-4 w-4 text-white"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" />
      </svg>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        className={`cursor-pointer appearance-none rounded border border-white/40 bg-black/60 py-1.5 pl-9 text-sm font-medium text-white outline-none focus:ring-2 focus:ring-white ${
          compact ? "w-10 pr-1 text-transparent sm:w-auto sm:pr-8 sm:text-white" : "pr-8"
        }`}
      >
        {languages.map((l) => (
          <option key={l} value={l} className="bg-ink-2 text-white">
            {l}
          </option>
        ))}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className={`pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-white ${compact ? "hidden sm:block" : ""}`}
        fill="currentColor"
      >
        <path d="M12 16 5 9h14z" />
      </svg>
    </label>
  );
}
