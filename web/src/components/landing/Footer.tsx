import Link from "next/link";
import { footerLinks } from "@/lib/landing-data";
import LanguageSelect from "./LanguageSelect";

export default function Footer() {
  return (
    <footer className="mx-auto max-w-7xl px-4 pb-16 pt-12 text-muted sm:px-8 lg:px-12">
      <p className="mb-6">
        Questions? Call{" "}
        <a href="tel:+2348000000000" className="underline hover:text-white">
          0800 000 0000
        </a>
      </p>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
        {footerLinks.map((l) => (
          <li key={l}>
            <Link href={l === "FAQ" ? "#faq" : "#"} className="underline hover:text-white">
              {l}
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-8">
        <LanguageSelect />
      </div>
      <p className="mt-6 text-sm">MyFlix Nigeria</p>
    </footer>
  );
}
