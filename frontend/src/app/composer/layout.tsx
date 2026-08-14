"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import AppleGlobalNav from "@/components/common/AppleGlobalNav";
import { prefersReducedMotion } from "@/lib/motion";

const TABS = [
  { href: "/composer", label: "Compose" },
  { href: "/composer/live-predict", label: "Live Predict" },
  { href: "/composer/predictions", label: "Predictions" },
  { href: "/composer/posts", label: "Posts" },
  { href: "/composer/analytics", label: "Analytics" },
  { href: "/stories", label: "Vault" },
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

      {/* Composer Sub-Nav Pill Bar */}
      <div
        style={{
          borderBottom: "1px solid var(--border)",
          background: "#ffffff",
          padding: "12px var(--space-lg)",
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
            gap: "var(--space-md)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--wire-red)",
                boxShadow: "0 0 8px var(--wire-red)",
              }}
            />
            <span className="text-micro" style={{ color: "#000000", fontWeight: 700 }}>
              PRESS BOX STUDIO
            </span>
          </div>

          <nav style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
            {TABS.map((tab) => {
              const active = pathname === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={active ? "ds-btn-pill ds-btn-pill-dark" : "ds-btn-pill ds-btn-pill-light"}
                  style={{
                    textDecoration: "none",
                    fontSize: 12,
                    padding: "6px 16px",
                  }}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <motion.main
        initial={isReduced ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        style={{
          padding: "var(--space-xl) var(--space-lg)",
          maxWidth: 1200,
          margin: "0 auto",
        }}
      >
        {children}
      </motion.main>
    </div>
  );
}
