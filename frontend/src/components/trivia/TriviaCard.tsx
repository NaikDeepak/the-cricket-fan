"use client";
import { useEffect, useRef, useState } from "react";
import { gsap } from "@/lib/gsap";
import type { TriviaData } from "@/lib/api";

export default function TriviaCard({ data }: { data: TriviaData }) {
  const [selected, setSelected] = useState<number | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const revealRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tl = gsap.timeline({
      scrollTrigger: { trigger: sectionRef.current, start: "top 75%" }
    });

    tl.fromTo(
      optionRefs.current.filter(Boolean),
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        duration: 0.6,
        stagger: 0.1,
        ease: "expo.out",
      }
    );
    return () => { tl.kill(); };
  }, []);

  const handleTap = (idx: number) => {
    if (selected !== null) return;
    setSelected(idx);
    
    const isCorrect = idx === data.correct_index;

    if (revealRef.current) {
      revealRef.current.style.display = "flex";
      gsap.fromTo(revealRef.current, { opacity: 0, x: 20 }, { opacity: 1, x: 0, duration: 0.8, ease: "expo.out" });
    }
  };

  return (
    <section
      ref={sectionRef}
      data-section="3"
      className="max-w-6xl mx-auto py-24 px-6"
    >
      <div className="flex justify-between text-micro mb-6">
        <span>TRIVIA</span>
        <span>TODAY&apos;S PICK</span>
      </div>

      <div className="divider mb-12 opacity-30" />

      <div className="grid grid-cols-1 md:grid-cols-[1fr_400px] gap-12">
        <div>
          <h2 className="text-section-headline mb-12" style={{ textTransform: "none" }}>
            {data.question}
          </h2>

          <div className="grid grid-cols-2 gap-4">
            {data.options.map((opt, i) => (
              <button
                key={i}
                ref={(el) => { optionRefs.current[i] = el; }}
                onClick={() => handleTap(i)}
                className={`p-10 text-4xl font-bold border transition-all duration-300 ${
                  selected === i 
                    ? (i === data.correct_index ? "bg-[var(--team-b)] text-black border-[var(--team-b)]" : "bg-red-500/20 border-red-500 text-white opacity-50")
                    : "bg-zinc-900 border-white/10 text-white hover:border-white/40"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 mt-8 text-orange-500 font-bold tracking-tight">
            <span>🔥 3 STREAK — YOU&apos;RE ON FIRE</span>
          </div>
        </div>

        <div 
          ref={revealRef} 
          className="hidden flex-col justify-center bg-zinc-900/50 border border-white/5 p-12 rounded-sm"
        >
          <span className="text-[var(--team-b)] text-8xl font-black mb-4">
            {data.options[data.correct_index]}
          </span>
          <p className="text-xl font-bold text-[var(--team-b)] mb-6 tracking-tight uppercase">
            {data.emphasis}
          </p>
          <p className="text-white/70 leading-relaxed text-lg mb-8">
            {data.fact}
          </p>
          
          <button className="w-full py-4 border border-[var(--team-b)] text-[var(--team-b)] text-xs font-bold tracking-widest uppercase hover:bg-[var(--team-b)] hover:text-black transition-all">
            SHARE THIS FACT →
          </button>
        </div>
      </div>
    </section>
  );
}
