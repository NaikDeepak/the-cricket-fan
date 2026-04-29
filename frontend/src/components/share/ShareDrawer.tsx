"use client";
import { useEffect, useRef, useState } from "react";
import { gsap } from "@/lib/gsap";
import ShockStatCard from "./ShockStatCard";
import { captureCard, shareCard } from "@/lib/share";
import type { StoryData } from "@/lib/api";

type Props = { data: StoryData; open: boolean; onClose: () => void };

export default function ShareDrawer({ data, open, onClose }: Props) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const card916Ref = useRef<HTMLDivElement>(null);
  const card11Ref = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!drawerRef.current || !overlayRef.current) return;
    const isMobile = window.innerWidth < 768;

    if (open) {
      document.body.style.overflow = "hidden";
      gsap.to(overlayRef.current, { opacity: 0.6, duration: 0.3 });
      gsap.to(drawerRef.current, {
        [isMobile ? "y" : "x"]: 0,
        duration: 0.5,
        ease: "cubic-bezier(0.22, 1, 0.36, 1)",
      });
    } else {
      document.body.style.overflow = "";
      gsap.to(overlayRef.current, { opacity: 0, duration: 0.3 });
      gsap.to(drawerRef.current, {
        [isMobile ? "y" : "x"]: "100%",
        duration: 0.35,
        ease: "power2.in",
      });
    }
  }, [open]);

  const handleShare = async (ratio: "9:16" | "1:1") => {
    const el = ratio === "9:16" ? card916Ref.current : card11Ref.current;
    if (!el) return;
    setSharing(true);
    try {
      const blob = await captureCard(el);
      await shareCard(blob, `cricket-fan-${ratio.replace(":", "x")}.png`);
    } finally {
      setSharing(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div
        ref={overlayRef}
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "#000", opacity: 0, zIndex: 40,
        }}
      />
      <div
        ref={drawerRef}
        style={{
          position: "fixed",
          right: 0, top: 0, bottom: 0,
          width: "min(480px, 100vw)",
          background: "var(--surface)",
          zIndex: 50,
          transform: "translateX(100%)",
          padding: "32px",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
          overflowY: "auto",
        }}
      >
        <div className="flex justify-between items-center">
          <p className="text-micro" style={{ color: "var(--fg)" }}>SHARE</p>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--fg)", fontSize: "20px", cursor: "pointer" }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div style={{ width: "100%", height: "1px", background: "var(--border)" }} />

        <div className="flex gap-4">
          <button
            onClick={() => handleShare("9:16")}
            disabled={sharing}
            style={{
              flex: 1, padding: "16px", border: "1px solid var(--border)",
              background: "none", color: "var(--fg)", fontFamily: "Space Grotesk, sans-serif",
              fontSize: "13px", letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer",
            }}
          >
            STORY (9:16)
          </button>
          <button
            onClick={() => handleShare("1:1")}
            disabled={sharing}
            style={{
              flex: 1, padding: "16px", border: "1px solid var(--border)",
              background: "none", color: "var(--fg)", fontFamily: "Space Grotesk, sans-serif",
              fontSize: "13px", letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer",
            }}
          >
            SQUARE (1:1)
          </button>
        </div>

        <p className="text-micro" style={{ textAlign: "center" }}>
          {sharing ? "CAPTURING..." : "TAP TO SHARE OR DOWNLOAD"}
        </p>

        {/* Off-screen DOM twins */}
        <ShockStatCard ref={card916Ref} data={data} ratio="9:16" />
        <ShockStatCard ref={card11Ref} data={data} ratio="1:1" />
      </div>
    </>
  );
}
