"use client";

import { useState } from "react";
import { faqs } from "@/lib/landing-data";
import EmailCapture from "./EmailCapture";

export default function Faq() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="mx-auto max-w-7xl px-4 py-8 sm:px-8 lg:px-12">
      <h2 className="mb-4 text-xl font-bold sm:text-2xl">Frequently Asked Questions</h2>
      <ul className="space-y-2">
        {faqs.map((f, i) => {
          const isOpen = open === i;
          return (
            <li key={f.question}>
              <h3>
                <button
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${i}`}
                  id={`faq-btn-${i}`}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between bg-ink-3 px-6 py-6 text-left text-lg font-medium transition hover:bg-line sm:text-2xl"
                >
                  {f.question}
                  <svg
                    aria-hidden
                    viewBox="0 0 24 24"
                    className={`h-8 w-8 shrink-0 transition-transform duration-300 sm:h-10 sm:w-10 ${isOpen ? "rotate-45" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M12 4v16M4 12h16" />
                  </svg>
                </button>
              </h3>
              <div
                id={`faq-panel-${i}`}
                role="region"
                aria-labelledby={`faq-btn-${i}`}
                className={`grid transition-[grid-template-rows] duration-300 ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
              >
                <div className="overflow-hidden">
                  <div className="mt-px space-y-4 bg-ink-3 px-6 py-6 text-lg sm:text-2xl">
                    {f.answer.map((p) => (
                      <p key={p}>{p}</p>
                    ))}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mx-auto mt-12 max-w-4xl text-center">
        <EmailCapture />
      </div>
    </section>
  );
}
