"use client";
import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";
import type { StatRow } from "@/lib/api";

export default function HeroStats({ stats }: { stats: StatRow[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const numbers = ref.current.querySelectorAll<HTMLSpanElement>("[data-count]");

    numbers.forEach((el, i) => {
      const target = parseFloat(el.dataset.count ?? "0");
      const suffix = el.dataset.suffix ?? "";
      gsap.fromTo(
        el,
        // @ts-ignore — GSAP supports innerText tween via its text plugin logic
        { innerText: 0 },
        {
          innerText: isNaN(target) ? 0 : target,
          duration: 0.8,
          delay: 0.4 + i * 0.12,
          ease: "power2.out",
          snap: { innerText: 1 },
          onUpdate() {
            el.textContent = Math.round(parseFloat(el.innerText)) + suffix;
          },
        }
      );
    });
  }, []);

  const colorVar = (color: string) => {
    if (color === "team_a") return "var(--team-a)";
    if (color === "team_b") return "var(--team-b)";
    return "var(--muted)";
  };

  return (
    <div ref={ref} className="grid grid-cols-3 gap-8 w-full">
      {stats.map((s, i) => {
        const numericVal = parseFloat(s.value.replace("%", ""));
        const suffix = s.value.includes("%") ? "%" : "";
        return (
          <div key={i} className="flex flex-col gap-2">
            <span
              className="text-stat-hero"
              style={{ color: colorVar(s.color) }}
              data-count={numericVal}
              data-suffix={suffix}
            >
              0{suffix}
            </span>
            <span className="text-micro">{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}
