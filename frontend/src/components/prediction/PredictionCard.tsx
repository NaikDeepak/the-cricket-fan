"use client";
import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";
import type { PredictionData } from "@/lib/api";

export default function PredictionCard({ data }: { data: PredictionData }) {
  const sectionRef = useRef<HTMLElement>(null);
  const evidenceRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dividerRef = useRef<HTMLDivElement>(null);
  const thereforeRef = useRef<HTMLParagraphElement>(null);
  const numberRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const tl = gsap.timeline({
      scrollTrigger: { trigger: sectionRef.current, start: "top 65%" },
      defaults: { ease: "cubic-bezier(0.22, 1, 0.36, 1)" },
    });

    evidenceRefs.current.forEach((el, i) => {
      tl.fromTo(el, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5 }, i * 0.4);
      const bars = el?.querySelectorAll<HTMLDivElement>("[data-evidence-bar]");
      bars?.forEach((bar) => {
        tl.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 0.5, transformOrigin: "left" }, i * 0.4 + 0.15);
      });
    });

    tl.fromTo(dividerRef.current, { scaleX: 0 }, { scaleX: 1, duration: 0.4, transformOrigin: "left" }, 1.4)
      .fromTo(thereforeRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3 }, 1.8);

    // Proxy count-up (no innerText tween — matches HeroStats pattern)
    const proxy = { val: 0 };
    const numberEl = numberRef.current;
    tl.fromTo(
      proxy,
      { val: 0 },
      {
        val: data.probability,
        duration: 0.8,
        snap: { val: 1 },
        ease: "power2.out",
        onUpdate() {
          if (numberEl) numberEl.textContent = Math.round(proxy.val) + "%";
        },
      },
      2.0
    );

    return () => { tl.kill(); };
  }, [data.probability]);

  return (
    <section
      ref={sectionRef}
      data-section="4"
      style={{ padding: "clamp(80px, 10vw, 140px) clamp(24px, 5vw, 48px)" }}
    >
      <p className="text-micro mb-8">PREDICTION</p>
      <div className="w-full h-px mb-10" style={{ background: "var(--border)" }} />

      <h2 className="text-section-headline mb-12" style={{ color: data.team_color }}>
        THE CASE FOR {data.team}
      </h2>

      <div className="flex flex-col gap-10 mb-12">
        {data.evidence.map((item, i) => (
          <div key={i} ref={(el) => { evidenceRefs.current[i] = el; }} className="opacity-0">
            <div className="flex items-start gap-4 mb-3">
              <span className="text-micro" style={{ minWidth: "24px" }}>
                0{i + 1}
              </span>
              <div>
                <p style={{ fontWeight: 600, fontSize: "16px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--fg)" }}>
                  {item.label}
                </p>
                <p className="text-micro mt-1">{item.detail}</p>
              </div>
            </div>
            <div className="flex gap-1 h-1 ml-10">
              <div
                data-evidence-bar
                style={{ flex: 1, height: "4px", background: data.team_color, transformOrigin: "left", transform: "scaleX(0)" }}
              />
              <div
                data-evidence-bar
                style={{ flex: 1, height: "4px", background: "var(--muted)", transformOrigin: "left", transform: "scaleX(0)", opacity: 0.4 }}
              />
            </div>
          </div>
        ))}
      </div>

      <div ref={dividerRef} className="w-full h-px mb-6" style={{ background: "var(--border)", transform: "scaleX(0)" }} />
      <p ref={thereforeRef} className="text-micro mb-4 opacity-0">THEREFORE:</p>

      <div className="flex items-end gap-6">
        <span ref={numberRef} className="text-stat-hero" style={{ color: data.team_color }}>
          0%
        </span>
        <p className="text-micro mb-4">{data.team} WIN PROBABILITY</p>
      </div>
    </section>
  );
}
