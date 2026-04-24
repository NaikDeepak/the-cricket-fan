"use client";
import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";
import BattleBars from "./BattleBars";
import type { BattleData, TeamInfo } from "@/lib/api";

type Props = { data: BattleData; teamA: TeamInfo; teamB: TeamInfo };

export default function PlayerBattle({ data, teamA, teamB }: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const playerARef = useRef<HTMLSpanElement>(null);
  const playerBRef = useRef<HTMLSpanElement>(null);
  const verdictRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const tl = gsap.timeline({
      scrollTrigger: { trigger: sectionRef.current, start: "top 70%" },
      defaults: { ease: "cubic-bezier(0.22, 1, 0.36, 1)" },
    });

    tl.fromTo(playerARef.current, { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.5 })
      .fromTo(playerBRef.current, { opacity: 0, x: 30 }, { opacity: 1, x: 0, duration: 0.5 }, "<")
      .fromTo(verdictRef.current, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4 }, "+=0.4");

    return () => { tl.kill(); };
  }, []);

  const dismissals = data.stats.find((s) => s.label === "DISMISSALS")?.bowler_val ?? 0;

  return (
    <section
      ref={sectionRef}
      data-section="2"
      style={{ padding: "clamp(80px, 10vw, 140px) clamp(24px, 5vw, 48px)" }}
    >
      <div className="flex justify-between text-micro mb-8">
        <span>MATCH-UP</span>
        <span>01 / 01</span>
      </div>

      <div className="w-full h-px mb-8" style={{ background: "var(--border)" }} />

      <div className="flex justify-between items-center mb-8">
        <span ref={playerARef} className="text-player-name opacity-0" style={{ color: "var(--team-a)" }}>
          {data.batsman}
        </span>
        <span className="text-micro">VS</span>
        <span ref={playerBRef} className="text-player-name opacity-0" style={{ color: "var(--team-b)" }}>
          {data.bowler}
        </span>
      </div>

      <div className="w-full h-px mb-10" style={{ background: "var(--border)" }} />

      <BattleBars stats={data.stats} teamAColor={teamA.color} teamBColor={teamB.color} />

      <div className="w-full h-px mt-10 mb-6" style={{ background: "var(--border)" }} />

      <div ref={verdictRef} className="opacity-0">
        <p className="text-micro mb-3">VERDICT</p>
        <p style={{ fontSize: "18px", lineHeight: 1.6, color: "var(--fg)", maxWidth: "600px" }}>
          Jadeja owns this. {dismissals} dismissals. Tonight is {data.batsman.split(" ")[0]}&apos;s redemption arc.
        </p>
      </div>
    </section>
  );
}
