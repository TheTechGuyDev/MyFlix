import Link from "next/link";
import Logo from "./Logo";
import LanguageSelect from "./LanguageSelect";

export default function Header() {
  return (
    <header className="relative z-20 mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-5 sm:px-8 lg:px-12">
      <Logo />
      <div className="flex items-center gap-3">
        <LanguageSelect compact />
        <Link
          href="/login"
          className="rounded bg-brand px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-hover"
        >
          Sign In
        </Link>
      </div>
    </header>
  );
}
