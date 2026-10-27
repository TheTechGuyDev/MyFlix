import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const inter = localFont({
  src: "../fonts/Inter-Variable.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

const bebas = localFont({
  src: "../fonts/BebasNeue-Regular.woff2",
  variable: "--font-bebas",
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MyFlix Nigeria: Stream Nollywood, Movies and Series",
  description:
    "Stream Nollywood hits, international movies, series and documentaries in up to 4K. Plans from ₦1,500 a month. Cancel anytime.",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${bebas.variable} antialiased`}>
      <body className="min-h-screen bg-ink">{children}</body>
    </html>
  );
}
