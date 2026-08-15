"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { prefersReducedMotion } from "@/lib/motion";

export default function AppleGlobalNav() {
  const pathname = usePathname();
  const isReduced = prefersReducedMotion();

  const navItems = [
    { label: "The Vault", href: "/stories" },
    { label: "Composer", href: "/composer" },
    { label: "Posts", href: "/composer/posts" },
    { label: "Predictions", href: "/composer/predictions" },
    { label: "Analytics", href: "/composer/analytics" },
  ];

  return (
    <motion.header
      initial={isReduced ? false : { y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: "rgba(245, 245, 247, 0.85)",
        backdropFilter: "saturate(180%) blur(20px)",
        WebkitBackdropFilter: "saturate(180%) blur(20px)",
        borderBottom: "1px solid rgba(0, 0, 0, 0.08)",
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
        }}
      >
        {/* Brand logo & tagline */}
        <Link href="/stories" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "#000000",
              color: "#ffffff",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            🏏
          </span>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#000000", letterSpacing: "-0.03em" }}>
            TCF.
          </span>
        </Link>

        {/* Apple Style Nav Items */}
        <nav style={{ display: "flex", alignItems: "center", gap: "var(--space-lg)" }}>
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/stories" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? "#000000" : "var(--fg-muted)",
                  textDecoration: "none",
                  transition: "color 150ms ease",
                  padding: "4px 8px",
                  borderRadius: 6,
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right CTA */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
          <Link
            href="/composer"
            className="ds-btn-pill ds-btn-pill-dark"
            style={{ textDecoration: "none", fontSize: 12, padding: "6px 16px" }}
          >
            Composer ↗
          </Link>
        </div>
      </div>
    </motion.header>
  );
}
