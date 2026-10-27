import Link from "next/link";

export default function Logo({ className = "", tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  return (
    <Link href="/" aria-label="MyFlix home" className={`inline-flex items-center ${className}`}>
      <span className="font-display text-3xl leading-none tracking-wide sm:text-5xl">
        <span className={tone === "dark" ? "text-white" : "text-ink"}>MY</span>
        <span className="bg-gradient-to-b from-brand-bright to-brand bg-clip-text text-transparent">FLIX</span>
      </span>
    </Link>
  );
}
