import Image from "next/image";
import type { ReactNode } from "react";
import Logo from "@/components/landing/Logo";
import { unsplash } from "@/lib/landing-data";

export default function AuthBackdrop({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-ink">
      <div aria-hidden className="absolute inset-0 hidden sm:block">
        <Image src={unsplash("1536440136628-849c177e76a1", 1920)} alt="" fill priority sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/50 to-black/90" />
      </div>
      <header className="relative z-10 mx-auto w-full max-w-7xl px-4 py-5 sm:px-10">
        <Logo />
      </header>
      <main className="relative z-10 flex flex-1 items-start justify-center sm:px-4 sm:pb-16">{children}</main>
      <footer className="relative z-10 border-t border-line bg-black/80 px-5 py-8 text-sm text-muted sm:px-10">
        <div className="mx-auto max-w-5xl">
          <p className="mb-4">
            Questions? Call <a href="tel:+2348000000000" className="underline">0800 000 0000</a>
          </p>
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            {["FAQ", "Help Centre", "Terms of Use", "Privacy", "Cookie Preferences", "Corporate Information"].map((l) => (
              <a key={l} href="#" className="underline">{l}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
