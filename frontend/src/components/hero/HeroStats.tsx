"use client";
import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";
import type { StatRow } from "@/lib/api";

export default function HeroStats({ stats }: { stats: StatRow[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const numbers = ref.current.querySelectorAll<HTMLSpanElement>("[data-count]");
    const tweens: gsap.core.Tween[] = [];

    numbers.forEach((el, i) => {
      const target = parseFloat(el.dataset.count ?? "0");
      const suffix = el.dataset.suffix ?? "";
      if (isNaN(target)) return;

      const proxy = { val: 0 };
      const tween = gsap.fromTo(
        proxy,
        { val: 0 },
        {
          val: target,
          duration: 1,
          delay: 0.5 + i * 0.15,
          ease: "power3.out",
          snap: { val: 1 },
          onUpdate() {
            el.textContent = Math.round(proxy.val) + suffix;
          },
        }
      );
      tweens.push(tween);
    });

    return () => { tweens.forEach((t) => t.kill()); };
  }, []);

  const colorVar = (color: string) => {
    if (color === "team_a") return "var(--team-a)";
    if (color === "team_b") return "var(--team-b)";
    return "var(--fg)";
  };

  return (
    <div ref={ref} className="grid grid-cols-3 w-full max-w-5xl">
      {stats.map((s, i) => {
        const numericVal = parseFloat(s.value.replace("%", ""));
        const suffix = s.value.includes("%") ? "%" : "";
        return (
          <div key={i} className="flex flex-col items-center gap-2 relative">
            {i > 0 && <div className="absolute left-0 top-1/4 bottom-1/4 w-px bg-white/10" />}
            <span
              className="text-stat-hero"
              style={{ color: colorVar(s.color) }}
              data-count={numericVal}
              data-suffix={suffix}
            >
              0{suffix}
            </span>
            <span className="text-micro text-center px-4">{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}
