"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import type { Story } from "@/lib/storiesApi";
import { prefersReducedMotion } from "@/lib/motion";

const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

export default function OnThisDayRail({ stories }: { stories: Story[] }) {
  const railRef = useRef<HTMLElement>(null);
  // The rail only renders (and railRef only attaches) once `stories` arrives
  // from the parent's async fetch — it's `[]` on first mount. Key the
  // one-shot entrance on data arrival instead of raw mount, and guard with
  // this ref so it fires exactly once, not on every subsequent stories change.
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    if (hasAnimatedRef.current || prefersReducedMotion() || !railRef.current) return;
    hasAnimatedRef.current = true;
    const ctx = gsap.context(() => {
      gsap.from(railRef.current!.querySelectorAll("a"), {
        opacity: 0,
        x: 24,
        duration: 0.4,
        stagger: 0.06,
        ease: "power4.out",
        clearProps: "all",
      });
    }, railRef);
    return () => ctx.revert();
  }, [stories]);

  if (stories.length === 0) return null;
  return (
    <section
      ref={railRef}
      data-rail="on-this-day"
      style={{ marginBottom: "var(--space-xl)" }}
    >
      <p className="text-micro" style={{ color: "var(--wire-red)", margin: "0 0 var(--space-sm) 0" }}>
        On this day
      </p>
      <div style={{ display: "flex", gap: "var(--space-md)", overflowX: "auto", paddingBottom: "var(--space-sm)" }}>
        {stories.map((s) => (
          <Link
            key={s.content_key}
            href={`/stories/${encodeURIComponent(s.content_key)}`}
            className="ds-card"
            style={{
              minWidth: 320,
              flex: "0 0 auto",
              borderLeft: "3px solid var(--wire-red)",
              textDecoration: "none",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-sm)" }}>
              <span className="text-micro" style={{ color: "var(--wire-red)", margin: 0 }}>
                {s.event_month_day?.split("-")[1]}{" "}
                {MONTHS[Number(s.event_month_day?.split("-")[0]) - 1]}
                {s.year ? ` ${s.year}` : ""}
              </span>
            </div>
            <p className="text-title" style={{ margin: 0, color: "var(--fg)" }}>{s.title}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
