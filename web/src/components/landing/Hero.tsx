import T from "@/components/T";
import Image from "next/image";
import Header from "./Header";
import EmailCapture from "./EmailCapture";
import { trending, unsplash } from "@/lib/landing-data";

export default function Hero() {
  const tiles = [...trending, ...trending, ...trending].slice(0, 24);

  return (
    <section className="relative isolate overflow-hidden">
      {/* Poster mosaic background */}
      <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-1/4 -top-1/4 grid h-[150%] w-[150%] -rotate-12 grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
          {tiles.map((t, i) => (
            <div key={`${t.id}-${i}`} className="relative aspect-[2/3] overflow-hidden rounded-md">
              <Image src={unsplash(t.image, 300)} alt="" fill sizes="200px" className="object-cover" priority={i < 8} />
            </div>
          ))}
        </div>
        <div className="absolute inset-0 bg-black/65" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/20 to-black/90" />
      </div>

      <Header />

      <div className="mx-auto flex min-h-[560px] max-w-3xl flex-col items-center justify-center px-6 pb-20 pt-10 text-center sm:min-h-[640px] lg:pb-28">
        <span className="mb-5 rounded-full border border-brand-bright/40 bg-brand/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-bright">
          <T>Now streaming in Nigeria</T>
        </span>
        <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
          <T>Nollywood, Hollywood and everything in between</T>
        </h1>
        <p className="mt-4 text-lg font-medium sm:text-2xl"><T>Plans from ₦1,500. Cancel whenever you like.</T></p>
        <div className="mt-8 w-full">
          <EmailCapture />
        </div>
      </div>

      <div className="curve-divider relative h-24 w-full overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-full rounded-t-[50%] border-t-4 border-brand-bright/60 bg-ink" />
      </div>
    </section>
  );
}
