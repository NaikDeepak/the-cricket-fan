"use client";
import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";
import type { PvPStat } from "@/lib/api";

type Props = { stats: PvPStat[] };

export default function BattleBars({ stats }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const bars = ref.current.querySelectorAll<HTMLDivElement>("[data-bar]");
    const tweens: gsap.core.Tween[] = [];

    bars.forEach((bar) => {
      const side = bar.dataset.side;
      const tween = gsap.fromTo(
        bar,
        { scaleX: 0 },
        {
          scaleX: 1,
          duration: 1,
          ease: "expo.out",
          transformOrigin: side === "a" ? "right" : "left",
          scrollTrigger: { trigger: ref.current, start: "top 80%" },
        }
      );
      tweens.push(tween);
    });

    return () => {
      tweens.forEach((t) => {
        t.scrollTrigger?.kill();
        t.kill();
      });
    };
  }, []);

  return (
    <div ref={ref} className="flex flex-col gap-10 w-full max-w-5xl mx-auto">
      {stats.map((s, i) => {
        const maxVal = Math.max(s.batsman_val, s.bowler_val);
        const pctA = maxVal > 0 ? Math.round((s.batsman_val / maxVal) * 100) : 50;
        const pctB = maxVal > 0 ? Math.round((s.bowler_val / maxVal) * 100) : 50;
        
        return (
          <div key={i} className="flex flex-col gap-4">
            <div className="flex justify-between items-center px-2">
              <span className="text-2xl font-bold" style={{ color: "var(--team-a)" }}>{s.batsman_val}</span>
              <span className="text-micro opacity-60">{s.label}</span>
              <span className="text-2xl font-bold" style={{ color: "var(--team-b)" }}>{s.bowler_val}</span>
            </div>
            
            <div className="flex h-3 gap-2">
              {/* Left Bar (Batsman) */}
              <div className="flex-1 flex justify-end overflow-hidden">
                <div
                  data-bar={pctA}
                  data-side="a"
                  style={{
                    width: `${pctA}%`,
                    background: "var(--team-a)",
                    height: "100%",
                    transformOrigin: "right",
                    boxShadow: "0 0 15px color-mix(in srgb, var(--team-a) 30%, transparent)",
                  }}
                  className="rounded-l-sm"
                />
              </div>
              
              {/* Right Bar (Bowler) */}
              <div className="flex-1 overflow-hidden">
                <div
                  data-bar={pctB}
                  data-side="b"
                  style={{
                    width: `${pctB}%`,
                    background: "var(--team-b)",
                    height: "100%",
                    transformOrigin: "left",
                    boxShadow: "0 0 15px color-mix(in srgb, var(--team-b) 30%, transparent)",
                  }}
                  className="rounded-r-sm"
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
