"use client";

import { useState } from "react";
import { Story } from "@/lib/storiesApi";

export type StoryCardModalProps = {
  story: Story | null;
  onClose: () => void;
};

export function StoryCardModal({ story, onClose }: StoryCardModalProps) {
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);

  if (!story) return null;

  const currentSegment = story.segments[activeSegmentIndex] || story.segments[0];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 999,
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "520px",
          background: "linear-gradient(145deg, #090d16 0%, #030407 100%)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "16px",
          padding: "24px",
          color: "#fff",
          boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "#ffcb05",
                background: "rgba(255,203,5,0.12)",
                padding: "2px 8px",
                borderRadius: "4px",
              }}
            >
              {story.match_format || "Cricket Lore"}
            </span>
            {story.year && (
              <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)" }}>
                {story.year}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.6)",
              fontSize: "20px",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        {/* Title & Summary */}
        <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px", color: "#fff" }}>
          {story.title}
        </h2>
        <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", marginBottom: "20px" }}>
          {story.summary}
        </p>

        {/* Story Segment Card Display */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "12px",
            padding: "20px",
            fontSize: "15px",
            lineHeight: "1.6",
            minHeight: "120px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            marginBottom: "16px",
          }}
        >
          <div>{currentSegment}</div>
          <div
            style={{
              marginTop: "12px",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.05em",
              color: "#00e5ff",
            }}
          >
            #TheCricketFan
          </div>
        </div>

        {/* Multi-Segment Carousel Controls */}
        {story.segments.length > 1 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <button
              disabled={activeSegmentIndex === 0}
              onClick={() => setActiveSegmentIndex((i) => Math.max(0, i - 1))}
              style={{
                padding: "6px 14px",
                fontSize: "12px",
                borderRadius: "6px",
                background: "rgba(255,255,255,0.1)",
                color: "#fff",
                border: "none",
                cursor: activeSegmentIndex === 0 ? "default" : "pointer",
                opacity: activeSegmentIndex === 0 ? 0.4 : 1,
              }}
            >
              ← Prev
            </button>
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)" }}>
              Beat {activeSegmentIndex + 1} of {story.segments.length}
            </span>
            <button
              disabled={activeSegmentIndex === story.segments.length - 1}
              onClick={() => setActiveSegmentIndex((i) => Math.min(story.segments.length - 1, i + 1))}
              style={{
                padding: "6px 14px",
                fontSize: "12px",
                borderRadius: "6px",
                background: "rgba(255,255,255,0.1)",
                color: "#fff",
                border: "none",
                cursor: activeSegmentIndex === story.segments.length - 1 ? "default" : "pointer",
                opacity: activeSegmentIndex === story.segments.length - 1 ? 0.4 : 1,
              }}
            >
              Next →
            </button>
          </div>
        )}

        {/* Provenance Footer */}
        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", display: "flex", justifyContent: "space-between" }}>
          <span>Source: {story.source_type || "Wikipedia"} ({story.source_ref})</span>
          <span>#TheCricketFan</span>
        </div>
      </div>
    </div>
  );
}
