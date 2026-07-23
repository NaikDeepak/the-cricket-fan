import type { Metadata } from "next";
import { Oswald } from "next/font/google";
import "./globals.css";

const oswald = Oswald({
  subsets: ["latin"],
  style: "normal",
  display: "swap",
  variable: "--font-oswald",
});

export const metadata: Metadata = {
  title: "The Cricket Fan — Composer",
  description: "Manual content composer for The Cricket Fan.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={oswald.variable}>
      <body>{children}</body>
    </html>
  );
}
