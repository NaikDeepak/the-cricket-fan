"use client";
import { useEffect, useRef, useState } from "react";
import { gsap } from "@/lib/gsap";
import type { TriviaData } from "@/lib/api";

export default function TriviaCard({ data }: { data: TriviaData }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const revealRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const tween = gsap.fromTo(
      optionRefs.current.filter(Boolean),
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        duration: 0.5,
        stagger: 0.08,
        ease: "cubic-bezier(0.22, 1, 0.36, 1)",
        scrollTrigger: { trigger: sectionRef.current, start: "top 70%" },
      }
    );
    return () => {
      tween.kill();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleTap = (idx: number) => {
    if (selected !== null) return;
    setSelected(idx);
    const isCorrect = idx === data.correct_index;

    if (!isCorrect) {
      gsap.to(optionRefs.current[idx], {
        keyframes: { x: [0, -8, 8, -6, 6, 0] },
        duration: 0.4,
        ease: "power2.inOut",
        onComplete() {
          gsap.to(optionRefs.current[idx], { opacity: 0.3, duration: 0.2 });
        },
      });
      const correct = optionRefs.current[data.correct_index];
      if (!correct) return;
      gsap.fromTo(
        correct,
        { rotationY: 90 },
        {
          rotationY: 0,
          duration: 0.5,
          ease: "cubic-bezier(0.22, 1, 0.36, 1)",
          onStart() {
            if (correct) correct.style.borderColor = "var(--team-a)";
          },
        }
      );
    } else {
      gsap.to(optionRefs.current[idx], {
        scale: 1.06,
        duration: 0.15,
        yoyo: true,
        repeat: 1,
        onStart() {
          if (optionRefs.current[idx]) {
            optionRefs.current[idx]!.style.borderColor = "var(--team-a)";
          }
        },
      });
      setStreak((s) => s + 1);
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (revealRef.current) {
        revealRef.current.style.display = "block";
        gsap.fromTo(revealRef.current, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.4 });
      }
    }, isCorrect ? 300 : 600);
  };

  return (
    <section
      ref={sectionRef}
      data-section="3"
      style={{ padding: "clamp(80px, 10vw, 140px) clamp(24px, 5vw, 48px)" }}
    >
      <div className="flex justify-between text-micro mb-8">
        <span>TRIVIA</span>
        <span>TODAY&apos;S PICK</span>
      </div>

      <div className="w-full h-px mb-10" style={{ background: "var(--border)" }} />

      <h2 className="text-section-headline mb-12" style={{ fontSize: "clamp(24px, 4vw, 48px)", maxWidth: "800px" }}>
        {data.question}
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10" style={{ perspective: "800px" }}>
        {data.options.map((opt, i) => (
          <button
            key={i}
            ref={(el) => { optionRefs.current[i] = el; }}
            onClick={() => handleTap(i)}
            style={{
              opacity: 0,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--fg)",
              fontSize: "48px",
              fontWeight: 700,
              fontFamily: "Space Grotesk, sans-serif",
              padding: "32px 16px",
              cursor: selected !== null ? "default" : "pointer",
              transition: "border-color 0.2s",
            }}
          >
            {opt}
          </button>
        ))}
      </div>

      <div ref={revealRef} style={{ display: "none" }}>
        <p className="text-stat-hero mb-4" style={{ color: "var(--team-a)", fontSize: "clamp(64px, 10vw, 120px)" }}>
          {data.options[data.correct_index]}
        </p>
        <p className="text-section-headline mb-6" style={{ fontSize: "clamp(20px, 3vw, 32px)" }}>
          {data.emphasis}
        </p>
        <p style={{ fontSize: "18px", lineHeight: 1.6, color: "var(--fg)", maxWidth: "600px" }}>
          {data.fact}
        </p>
        {streak > 0 && (
          <p className="text-micro mt-6" style={{ color: "var(--fg)" }}>
            {streak} CORRECT TODAY
          </p>
        )}
      </div>
    </section>
  );
}
