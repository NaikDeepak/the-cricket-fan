import type { Metadata } from "next";
import Link from "next/link";
import { Oswald } from "next/font/google";
import "./globals.css";

const oswald = Oswald({
  subsets: ["latin"],
  style: "normal",
  display: "swap",
  variable: "--font-oswald",
});

export const metadata: Metadata = {
  title: "The Cricket Fan",
  description: "Fan-first IPL match stories, battles, trivia, and predictions.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={oswald.variable}>
      <body>
        <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 bg-black/80 backdrop-blur border-b border-zinc-900">
          <Link href="/" className="text-white font-bold tracking-tight text-sm">
            The Cricket Fan
          </Link>
          <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
            <Link href="/explore" className="text-zinc-400 hover:text-white text-sm transition-colors">
              Explore
            </Link>
            <Link href="/archive" className="text-zinc-400 hover:text-white text-sm transition-colors">
              Past Matches
            </Link>
          </div>
        </nav>
        <div className="pt-12">{children}</div>
      </body>
    </html>
  );
}
