"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import AppleGlobalNav from "@/components/common/AppleGlobalNav";
import { prefersReducedMotion } from "@/lib/motion";

const TABS = [
  { href: "/composer", label: "Compose" },
  { href: "/composer/templates", label: "Templates" },
  { href: "/composer/live-predict", label: "Live Predict" },
  { href: "/composer/predictions", label: "Predictions" },
  { href: "/composer/backtest", label: "Backtest" },
  { href: "/composer/posts", label: "Posts" },
  { href: "/composer/analytics", label: "Analytics" },
  { href: "/composer/teams", label: "Teams" },
];

export default function ComposerLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isReduced = prefersReducedMotion();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        color: "var(--fg)",
      }}
    >
      <AppleGlobalNav />

      {/* Composer Sub-Nav Bar */}
      <div
        style={{
          borderBottom: "1px solid var(--border)",
          background: "#ffffff",
          padding: "10px var(--space-lg)",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "var(--space-sm)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "var(--fg)",
                letterSpacing: "-0.01em",
              }}
            >
              Studio
            </span>
            <span style={{ color: "var(--fg-muted)", fontSize: 13 }}>/</span>
            <span style={{ color: "var(--fg-muted)", fontSize: 13 }}>Press Box</span>
          </div>

          <nav className="ds-segmented-control">
            {TABS.map((tab) => {
              const active = pathname === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`ds-segmented-item ${active ? "ds-segmented-item--active" : ""}`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <motion.main
        initial={isReduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        style={{
          padding: "var(--space-lg)",
          maxWidth: 1200,
          margin: "0 auto",
        }}
      >
        {children}
      </motion.main>
    </div>
  );
}
