"use client";
import { useEffect, useRef } from "react";

export default function SectionCounter({ total }: { total: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sections = document.querySelectorAll("[data-section]");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && ref.current) {
            const num = e.target.getAttribute("data-section") ?? "1";
            ref.current.textContent = `${num.padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
          }
        });
      },
      { threshold: 0.5 }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [total]);

  return (
    <div
      ref={ref}
      className="text-micro fixed top-6 right-6 z-50"
      style={{ color: "var(--muted)" }}
    >
      01 / {String(total).padStart(2, "0")}
    </div>
  );
}
