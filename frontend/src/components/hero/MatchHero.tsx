"use client";
import { useEffect, useRef } from "react";
import { gsap, SplitText } from "@/lib/gsap";
import HeroStats from "./HeroStats";
import type { StoryData } from "@/lib/api";

export default function MatchHero({ data }: { data: StoryData }) {
  const heroRef = useRef<HTMLElement>(null);
  const teamARef = useRef<HTMLSpanElement>(null);
  const teamBRef = useRef<HTMLSpanElement>(null);
  const divider1Ref = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const divider2Ref = useRef<HTMLDivElement>(null);
  const scrollBaitRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!heroRef.current) return;
    const tl = gsap.timeline({ defaults: { ease: "cubic-bezier(0.22, 1, 0.36, 1)" } });

    tl.fromTo(teamARef.current, { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 0.6 }, 0)
      .fromTo(teamBRef.current, { opacity: 0, x: 40 }, { opacity: 1, x: 0, duration: 0.6 }, 0)
      .fromTo(divider1Ref.current, { scaleX: 0 }, { scaleX: 1, duration: 0.5, transformOrigin: "center" }, 0.3)
      .add(() => {
        if (!headlineRef.current) return;
        const split = new SplitText(headlineRef.current, { type: "words" });
        gsap.fromTo(
          split.words,
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: "cubic-bezier(0.22, 1, 0.36, 1)" }
        );
      }, 0.4)
      .fromTo(divider2Ref.current, { scaleX: 0 }, { scaleX: 1, duration: 0.5, transformOrigin: "center" }, 0.8)
      .fromTo(scrollBaitRef.current, { opacity: 0 }, { opacity: 1, duration: 0.4 }, 1.2);
  }, []);

  return (
    <section
      ref={heroRef}
      data-section="1"
      className="relative flex flex-col justify-between min-h-svh px-6 py-8 md:px-12"
    >
      <div className="hero-glow" />

      <div className="flex justify-between items-center text-micro z-10">
        <span>IPL 2026 · {data.venue}</span>
        <span>{data.match_time}</span>
      </div>

      <div className="flex flex-col gap-6 z-10">
        <div className="flex items-center justify-between">
          <span
            ref={teamARef}
            className="text-stat-hero opacity-0"
            style={{ color: "var(--team-a)" }}
          >
            {data.team_a.short_name}
          </span>
          <span className="text-micro">RIVALRY</span>
          <span
            ref={teamBRef}
            className="text-stat-hero opacity-0"
            style={{ color: "var(--team-b)" }}
          >
            {data.team_b.short_name}
          </span>
        </div>

        <div ref={divider1Ref} className="divider" style={{ transform: "scaleX(0)" }} />

        <h1
          ref={headlineRef}
          className="text-section-headline max-w-4xl"
          style={{ color: "var(--fg)" }}
        >
          {data.headline}
        </h1>

        <div ref={divider2Ref} className="divider" style={{ transform: "scaleX(0)" }} />

        <HeroStats stats={data.stats_row} />
      </div>

      <div
        ref={scrollBaitRef}
        className="flex justify-between items-center text-micro opacity-0 z-10"
      >
        <span style={{ color: "var(--fg)" }}>{data.scroll_bait}</span>
        <span>SEE THE BATTLE ↓</span>
      </div>
    </section>
  );
}
