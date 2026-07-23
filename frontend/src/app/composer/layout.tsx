"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export default function ComposerLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

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
        <nav className="flex" style={{ gap: "var(--space-lg)" }}>
          <Link
            href="/composer"
            className={`ds-nav-link${pathname === "/composer" ? " ds-nav-link--active" : ""}`}
          >
            FEED
          </Link>
          <Link
            href="/composer/analytics"
            className={`ds-nav-link${pathname === "/composer/analytics" ? " ds-nav-link--active" : ""}`}
          >
            ANALYTICS
          </Link>
        </nav>
      </header>
      <main
        style={{
          padding: "var(--space-lg)",
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        {children}
      </main>
    </div>
  );
}
