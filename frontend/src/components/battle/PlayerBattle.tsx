"use client";
import { useEffect, useRef } from "react";
import Image from "next/image";
import { gsap } from "@/lib/gsap";
import BattleBars from "./BattleBars";
import type { BattleData } from "@/lib/api";

type Props = { data: BattleData };

export default function PlayerBattle({ data }: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const playerARef = useRef<HTMLDivElement>(null);
  const playerBRef = useRef<HTMLDivElement>(null);
  const verdictRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const tl = gsap.timeline({
      scrollTrigger: { trigger: sectionRef.current, start: "top 70%" },
      defaults: { ease: "expo.out" },
    });

    tl.fromTo(playerARef.current, { opacity: 0, x: -50 }, { opacity: 1, x: 0, duration: 1 })
      .fromTo(playerBRef.current, { opacity: 0, x: 50 }, { opacity: 1, x: 0, duration: 1 }, "<")
      .fromTo(verdictRef.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8 }, "+=0.2");

    return () => { tl.kill(); };
  }, []);

  const dismissals = data.stats.find((s) => s.label === "DISMISSALS")?.bowler_val ?? 0;

  return (
    <section
      ref={sectionRef}
      data-section="2"
      className="max-w-6xl mx-auto py-24 px-6"
    >
      <div className="flex justify-between items-center text-micro mb-6">
        <span>MATCH-UP</span>
        <span>01 / 01</span>
      </div>

      <div className="divider mb-12 opacity-30" />

      <div className="flex justify-between items-end mb-12">
        <div ref={playerARef} className="flex items-center gap-6 opacity-0">
          <div className="relative w-24 h-24 md:w-32 md:h-32 rounded-full border-2 border-white/10 overflow-hidden bg-zinc-900">
            <Image
              src="/images/rohit_headshot.png"
              alt={data.batsman}
              fill
              className="object-cover"
            />
          </div>
          <span className="text-player-name" style={{ color: "var(--team-a)" }}>
            {data.batsman}
          </span>
        </div>

        <span className="text-micro mb-4 opacity-40">VS</span>

        <div ref={playerBRef} className="flex items-center gap-6 flex-row-reverse text-right opacity-0">
          <div className="relative w-24 h-24 md:w-32 md:h-32 rounded-full border-2 border-white/10 overflow-hidden bg-zinc-900">
            <Image
              src="/images/jadeja_headshot.png"
              alt={data.bowler}
              fill
              className="object-cover"
            />
          </div>
          <span className="text-player-name" style={{ color: "var(--team-b)" }}>
            {data.bowler}
          </span>
        </div>
      </div>

      <div className="divider mb-12 opacity-30" />

      <BattleBars stats={data.stats} />

      <div className="divider mt-16 mb-8 opacity-30" />

      <div ref={verdictRef} className="opacity-0 text-center flex flex-col items-center">
        <p className="text-micro mb-4">VERDICT</p>
        <h3 className="text-section-headline" style={{ fontSize: "28px", maxWidth: "800px", textTransform: "none" }}>
          {data.bowler.split(" ").at(-1)} owns this — {dismissals} dismissals. <br/>
          <span className="text-white/60 font-medium">Tonight is {data.batsman.split(" ")[0]}&apos;s redemption arc.</span>
        </h3>
      </div>
    </section>
  );
}
