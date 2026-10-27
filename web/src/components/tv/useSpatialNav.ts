"use client";

import { useEffect } from "react";

/**
 * TV remote / D-pad navigation. Arrow keys move focus to the nearest [data-nav] element in that
 * direction; Enter activates it; Back (Backspace, Escape, or the remote's Back key) calls onBack.
 */
export function useSpatialNav(onBack: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const items = () =>
      Array.from(document.querySelectorAll<HTMLElement>("[data-nav]")).filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && !el.hasAttribute("disabled");
      });

    const focusFirst = () => {
      const pref = document.querySelector<HTMLElement>("[data-nav-default]") ?? items()[0];
      pref?.focus();
    };

    const move = (dx: number, dy: number) => {
      const cur = document.activeElement as HTMLElement | null;
      if (!cur || !cur.hasAttribute("data-nav")) return focusFirst();
      const a = cur.getBoundingClientRect();
      const ax = a.left + a.width / 2;
      const ay = a.top + a.height / 2;
      let best: HTMLElement | null = null;
      let bestScore = Infinity;
      for (const el of items()) {
        if (el === cur) continue;
        const b = el.getBoundingClientRect();
        const bx = b.left + b.width / 2;
        const by = b.top + b.height / 2;
        const ddx = bx - ax;
        const ddy = by - ay;
        // Must be in the pressed direction
        if (dx && Math.sign(ddx) !== dx) continue;
        if (dy && Math.sign(ddy) !== dy) continue;
        if (dx && Math.abs(ddx) < 4) continue;
        if (dy && Math.abs(ddy) < 4) continue;
        const primary = dx ? Math.abs(ddx) : Math.abs(ddy);
        const cross = dx ? Math.abs(ddy) : Math.abs(ddx);
        const score = primary + cross * 3;
        if (score < bestScore) {
          bestScore = score;
          best = el;
        }
      }
      if (best) {
        best.focus({ preventScroll: true });
        best.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
      }
    };

    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (map[e.key]) {
        e.preventDefault();
        move(...map[e.key]);
      } else if (e.key === "Backspace" || e.key === "Escape" || e.key === "GoBack" || e.key === "BrowserBack" || e.keyCode === 10009 || e.keyCode === 461) {
        e.preventDefault();
        onBack();
      }
    };
    window.addEventListener("keydown", onKey);
    const t = setTimeout(() => {
      if (!(document.activeElement as HTMLElement)?.hasAttribute?.("data-nav")) focusFirst();
    }, 50);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [onBack, enabled]);
}
