"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { gsap, SplitText } from "@/lib/gsap";
import HeroStats from "./HeroStats";
import ShareDrawer from "@/components/share/ShareDrawer";
import type { StoryData } from "@/lib/api";

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function MatchHero({ data }: { data: StoryData }) {
  const [shareOpen, setShareOpen] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const teamARef = useRef<HTMLDivElement>(null);
  const teamBRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const bgLeftRef = useRef<HTMLDivElement>(null);
  const bgRightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!heroRef.current) return;
    let split: InstanceType<typeof SplitText> | null = null;
    const tl = gsap.timeline({ defaults: { ease: "expo.out" } });

    tl.fromTo(bgLeftRef.current, { opacity: 0, x: -100 }, { opacity: 1, x: 0, duration: 1.5 }, 0)
      .fromTo(bgRightRef.current, { opacity: 0, x: 100 }, { opacity: 1, x: 0, duration: 1.5 }, 0)
      .fromTo(teamARef.current, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1 }, 0.5)
      .fromTo(teamBRef.current, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1 }, 0.6)
      .add(() => {
        if (!headlineRef.current) return;
        split = new SplitText(headlineRef.current, { type: "words" });
        gsap.fromTo(
          split.words,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.8, stagger: 0.05, ease: "power3.out" }
        );
      }, 0.8);

    return () => {
      tl.kill();
      split?.revert();
    };
  }, []);

  const colorA = data.team_a.color;
  const colorB = data.team_b.color;

  return (
    <section
      ref={heroRef}
      data-section="1"
      className="relative flex flex-col justify-between min-h-svh px-6 py-8 md:px-12 overflow-hidden bg-black"
    >
      {/* Team badge rings — animated in from sides */}
      <div
        ref={bgLeftRef}
        className="absolute opacity-0 z-0 rounded-full flex items-center justify-end pointer-events-none"
        style={{
          left: "-120px",
          top: "50%",
          transform: "translateY(-50%)",
          width: "360px",
          height: "360px",
          border: `1.5px solid ${hexToRgba(colorA, 0.38)}`,
          background: `radial-gradient(circle at 55% 50%, ${hexToRgba(colorA, 0.17)} 0%, ${hexToRgba(colorA, 0.05)} 55%, transparent 75%)`,
          boxShadow: `inset 0 0 80px ${hexToRgba(colorA, 0.1)}, 0 0 90px ${hexToRgba(colorA, 0.09)}, 0 0 200px ${hexToRgba(colorA, 0.04)}`,
          paddingRight: "80px",
        }}
      >
        <Image
          src={`/images/logos/${data.team_a.short_name.toLowerCase()}.png`}
          alt={data.team_a.short_name}
          width={110}
          height={110}
          className="object-contain"
          style={{ filter: "drop-shadow(0 0 12px rgba(255,255,255,0.08))" }}
          priority
        />
      </div>

      <div
        ref={bgRightRef}
        className="absolute opacity-0 z-0 rounded-full flex items-center justify-start pointer-events-none"
        style={{
          right: "-120px",
          top: "50%",
          transform: "translateY(-50%)",
          width: "360px",
          height: "360px",
          border: `1.5px solid ${hexToRgba(colorB, 0.38)}`,
          background: `radial-gradient(circle at 45% 50%, ${hexToRgba(colorB, 0.17)} 0%, ${hexToRgba(colorB, 0.05)} 55%, transparent 75%)`,
          boxShadow: `inset 0 0 80px ${hexToRgba(colorB, 0.1)}, 0 0 90px ${hexToRgba(colorB, 0.09)}, 0 0 200px ${hexToRgba(colorB, 0.04)}`,
          paddingLeft: "80px",
        }}
      >
        <Image
          src={`/images/logos/${data.team_b.short_name.toLowerCase()}.png`}
          alt={data.team_b.short_name}
          width={110}
          height={110}
          className="object-contain"
          style={{ filter: "drop-shadow(0 0 12px rgba(255,255,255,0.08))" }}
          priority
        />
      </div>

      <div className="flex justify-between items-center text-micro z-10 font-medium">
        <span>IPL 2026 · {data.venue}</span>
        <span>{data.match_time}</span>
      </div>

      <div className="flex flex-col items-center justify-center flex-1 z-10 py-12">
        <div className="flex items-center justify-center gap-8 md:gap-16 mb-8">
          <div ref={teamARef} className="flex flex-col items-center opacity-0">
            <span className="text-team-logo" style={{ color: "var(--team-a)" }}>
              {data.team_a.short_name}
            </span>
          </div>
          <span className="text-micro mt-4">VS</span>
          <div ref={teamBRef} className="flex flex-col items-center opacity-0">
            <span className="text-team-logo" style={{ color: "var(--team-b)" }}>
              {data.team_b.short_name}
            </span>
          </div>
        </div>

        <div className="w-full h-px bg-white/10 mb-8 max-w-5xl" />

        <h1
          ref={headlineRef}
          className="text-section-headline text-center max-w-4xl mb-8"
        >
          {data.headline}
        </h1>

        <div className="w-full h-px bg-white/10 mb-12 max-w-5xl" />

        <HeroStats stats={data.stats_row} />
      </div>

      <div className="flex justify-between items-center text-micro z-10">
        <span className="text-white/60">{data.scroll_bait}</span>
        <span className="flex items-center gap-2">SEE THE BATTLE <span className="animate-bounce">↓</span></span>
      </div>

      <button
        onClick={() => setShareOpen(true)}
        className="fixed bottom-6 right-6 z-30 bg-white text-black px-6 py-3 text-xs font-bold tracking-widest uppercase hover:bg-white/90 transition-colors"
      >
        SHARE
      </button>
      <ShareDrawer data={data} open={shareOpen} onClose={() => setShareOpen(false)} />
    </section>
  );
}
