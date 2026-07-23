import Link from "next/link";
import type { ReactNode } from "react";

export default function ComposerLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        color: "var(--fg)",
      }}
    >
      <header
        className="flex items-center justify-between"
        style={{
          padding: "20px 24px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <span className="text-micro" style={{ color: "var(--fg)" }}>
          🏏 COMPOSER
        </span>
        <nav className="flex gap-6">
          <Link href="/composer" className="text-micro">
            FEED
          </Link>
          <Link href="/composer/analytics" className="text-micro">
            ANALYTICS
          </Link>
        </nav>
      </header>
      <main style={{ padding: "24px", maxWidth: 1100, margin: "0 auto" }}>
        {children}
      </main>
    </div>
  );
}
