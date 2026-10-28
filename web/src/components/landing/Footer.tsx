import Link from "next/link";
import LanguageSelect from "./LanguageSelect";

const links: [string, string][] = [
  ["FAQ", "/#faq"],
  ["Help Centre", "/help"],
  ["Account", "/account"],
  ["Ways to Watch", "/help"],
  ["Watch on TV", "/tv"],
  ["Gift Cards", "/account/gift"],
  ["Terms of Use", "/terms"],
  ["Privacy", "/privacy"],
  ["Cookie Policy", "/cookies"],
  ["Contact Us", "/help"],
];

export default function Footer() {
  return (
    <footer className="mx-auto max-w-7xl px-4 pb-16 pt-12 text-muted sm:px-8 lg:px-12">
      <p className="mb-6">
        Questions? Email{" "}
        <a href="mailto:help@myflix.ng" className="underline hover:text-white">
          help@myflix.ng
        </a>
      </p>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
        {links.map(([label, href]) => (
          <li key={label}>
            <Link href={href} className="underline hover:text-white">
              {label}
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-8">
        <LanguageSelect />
      </div>
      <p className="mt-6 text-sm">© {new Date().getFullYear()} MyFlix Nigeria</p>
    </footer>
  );
}
