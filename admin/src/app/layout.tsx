import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const inter = localFont({ src: "../fonts/Inter-Variable.woff2", variable: "--font-inter", weight: "100 900", display: "swap" });
const bebas = localFont({ src: "../fonts/BebasNeue-Regular.woff2", variable: "--font-bebas", weight: "400", display: "swap" });

export const metadata: Metadata = {
  title: "MyFlix Admin",
  description: "MyFlix content, subscribers and operations dashboard",
};

const themeScript = `try{var t=localStorage.getItem('myflix.admin.theme');if(t==='dark'||(!t&&false))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${bebas.variable} antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen">
        <div className="app-bg" aria-hidden />
        {children}
      </body>
    </html>
  );
}
