"use client";
import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";
import type { PvPStat } from "@/lib/api";

type Props = { stats: PvPStat[]; teamAColor: string; teamBColor: string };

export default function BattleBars({ stats, teamAColor, teamBColor }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const bars = ref.current.querySelectorAll<HTMLDivElement>("[data-bar]");
    const tweens: gsap.core.Tween[] = [];

    bars.forEach((bar) => {
      const pct = parseFloat(bar.dataset.bar ?? "50");
      const side = bar.dataset.side;
      const tween = gsap.fromTo(
        bar,
        { scaleX: 0 },
        {
          scaleX: 1,
          duration: 0.6,
          ease: "cubic-bezier(0.22, 1, 0.36, 1)",
          transformOrigin: side === "a" ? "right" : "left",
          scrollTrigger: { trigger: ref.current, start: "top 75%" },
          onComplete() {
            if (pct > 50) {
              gsap.to(bar, { scaleX: 0.96, duration: 0.1, yoyo: true, repeat: 1 });
            }
          },
        }
      );
      tweens.push(tween);
    });

    return () => { tweens.forEach((t) => t.kill()); };
  }, []);

  return (
    <div ref={ref} className="flex flex-col gap-6 w-full">
      {stats.map((s, i) => {
        const maxVal = Math.max(s.batsman_val, s.bowler_val);
        const pctA = maxVal > 0 ? Math.round((s.batsman_val / maxVal) * 100) : 50;
        const pctB = maxVal > 0 ? Math.round((s.bowler_val / maxVal) * 100) : 50;
        const aWins = s.batsman_val > s.bowler_val;
        return (
          <div key={i} className="flex flex-col gap-2">
            <div className="flex justify-between text-micro">
              <span style={{ color: teamAColor }}>{s.batsman_val}</span>
              <span>{s.label}</span>
              <span style={{ color: teamBColor }}>{s.bowler_val}</span>
            </div>
            <div className="flex h-1 gap-px">
              <div className="flex-1 flex justify-end overflow-hidden">
                <div
                  data-bar={pctA}
                  data-side="a"
                  style={{
                    width: `${pctA}%`,
                    background: aWins ? teamAColor : "var(--muted)",
                    height: "4px",
                    transformOrigin: "right",
                  }}
                />
              </div>
              <div className="flex-1 overflow-hidden">
                <div
                  data-bar={pctB}
                  data-side="b"
                  style={{
                    width: `${pctB}%`,
                    background: !aWins ? teamBColor : "var(--muted)",
                    height: "4px",
                    transformOrigin: "left",
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
