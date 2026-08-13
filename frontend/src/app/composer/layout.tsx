"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const TABS = [
  { href: "/composer", label: "Compose" },
  { href: "/composer/predictions", label: "Predictions" },
  { href: "/composer/posts", label: "Posts" },
  { href: "/composer/analytics", label: "Analytics" },
  { href: "/stories", label: "Vault" },
];

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
          flexWrap: "wrap",
          gap: "var(--space-md)",
        }}
      >
        <span className="text-micro" style={{ color: "var(--fg)" }}>
          🏏 COMPOSER
        </span>
        <nav className="flex" style={{ gap: "var(--space-lg)", flexWrap: "wrap" }}>
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`ds-nav-link${pathname === tab.href ? " ds-nav-link--active" : ""}`}
            >
              {tab.label}
            </Link>
          ))}
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
