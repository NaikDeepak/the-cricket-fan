"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { prefersReducedMotion } from "@/lib/motion";

export default function AppleGlobalNav() {
  const rawPathname = usePathname();
  const pathname = rawPathname || "";
  const isReduced = prefersReducedMotion();

  const navItems = [
    { label: "The Vault", href: "/stories" },
    { label: "Track Record", href: "/predictions" },
    { label: "Composer", href: "/composer" },
    { label: "Backtest", href: "/composer/backtest" },
    { label: "Live Predict", href: "/composer/live-predict" },
    { label: "Posts", href: "/composer/posts" },
    { label: "Analytics", href: "/composer/analytics" },
  ];

  return (
    <motion.header
      initial={isReduced ? false : { y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: "rgba(255, 255, 257, 0.85)",
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
        {/* Brand logo */}
        <Link
          href="/stories"
          style={{
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 26,
              height: 26,
              borderRadius: 6,
              background: "#1d1d1f",
              color: "#ffffff",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "-0.04em",
            }}
          >
            TCF
          </span>
          <span
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#1d1d1f",
              letterSpacing: "-0.02em",
            }}
          >
            The Cricket Fan
          </span>
        </Link>

        {/* Apple Style Nav Items */}
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-xs)",
          }}
        >
          {navItems.map((item) => {
            const isActive =
              item.href === "/composer"
                ? pathname === "/composer"
                : pathname === item.href || (item.href !== "/stories" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "#1d1d1f" : "#6e6e73",
                  textDecoration: "none",
                  padding: "6px 12px",
                  borderRadius: 6,
                  background: isActive ? "rgba(0, 0, 0, 0.05)" : "transparent",
                  transition: "all 150ms ease",
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
            className="ds-btn ds-btn-primary"
            style={{
              fontSize: 12,
              padding: "6px 14px",
              borderRadius: 6,
            }}
          >
            Studio
          </Link>
        </div>
      </div>
    </motion.header>
  );
}
