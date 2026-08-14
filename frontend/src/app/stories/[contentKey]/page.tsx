"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Story, storiesApi } from "@/lib/storiesApi";
import StoryBeats from "@/components/stories/StoryBeats";
import StoryCardImg from "@/components/stories/StoryCardImg";
import { captureCard, downloadCard } from "@/lib/share";
import { HERO_REVEAL_VARIANTS, prefersReducedMotion } from "@/lib/motion";

const CATEGORY_LABEL: Record<string, string> = {
  wiki_record: "Record",
  anecdote: "Anecdote",
  story: "Story",
};

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export default function StoryDetailPage({
  params,
}: {
  params: Promise<{ contentKey: string }>;
}) {
  const { contentKey } = use(params);
  const key = decodeURIComponent(contentKey);
  const [story, setStory] = useState<Story | null>(null);
  const [siblings, setSiblings] = useState<Story[]>([]);
  const [notFound, setNotFound] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const isReduced = prefersReducedMotion();

  useEffect(() => {
    let cancelled = false;
    storiesApi
      .getStoryByKey(key)
      .then((s) => {
        if (!cancelled) {
          setStory(s);
          setNotFound(false);
        }
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      });
    storiesApi
      .listStories()
      .then((s) => {
        if (!cancelled) setSiblings(s);
      })
      .catch(() => {
        if (!cancelled) setSiblings([]);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  async function handleDownload() {
    if (!cardRef.current || !story) return;
    setExporting(true);
    try {
      const blob = await captureCard(cardRef.current);
      await downloadCard(
        blob,
        `${story.content_key.replace(/[^a-z0-9]+/gi, "-")}.png`
      );
    } finally {
      setExporting(false);
    }
  }

  const containerStyle = {
    maxWidth: 800,
    margin: "0 auto",
    padding: "0 var(--space-lg) var(--space-xl)",
    position: "relative" as const,
  };

  if (notFound) {
    return (
      <div style={{ ...containerStyle, textAlign: "center", paddingTop: "var(--space-xl)" }}>
        <p className="text-micro" style={{ margin: "0 0 var(--space-md) 0", color: "var(--wire-red)" }}>
          STORY NOT FOUND
        </p>
        <Link href="/stories" className="ds-btn-pill ds-btn-pill-dark" style={{ textDecoration: "none" }}>
          ← Return to Vault
        </Link>
      </div>
    );
  }

  if (!story) {
    return (
      <div style={containerStyle}>
        <div className="ds-skeleton" style={{ maxWidth: 800, minHeight: 400, marginTop: "var(--space-xl)" }} />
      </div>
    );
  }

  const idx = siblings.findIndex((s) => s.content_key === key);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;
  const sourceIsLink = story.source_ref?.startsWith("http");

  return (
    <motion.div
      style={containerStyle}
      initial={isReduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Apple Header Bar */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "var(--space-md) 0 var(--space-lg)",
          borderBottom: "1px solid var(--border)",
          marginBottom: "var(--space-xl)",
        }}
      >
        <Link href="/stories" style={{ textDecoration: "none" }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: "#000000", letterSpacing: "-0.03em" }}>
            TCH.
          </span>
        </Link>
        <Link href="/stories" className="ds-btn-pill ds-btn-pill-dark" style={{ textDecoration: "none", fontSize: 13, padding: "8px 18px" }}>
          ← The Vault
        </Link>
      </header>

      {/* Watermark Year Numeral */}
      {story.year && (
        <div
          aria-hidden
          className="text-watermark"
          style={{
            position: "absolute",
            top: 100,
            right: 0,
            fontSize: "var(--text-4xl)",
            lineHeight: 0.8,
            zIndex: 0,
          }}
        >
          {story.year}
        </div>
      )}

      {/* Apple Vision Pro Spatial Detail Hero Panel */}
      <motion.div
        className="ds-spatial-card-dark"
        style={{
          borderRadius: 20,
          padding: "var(--space-xl)",
          marginBottom: "var(--space-xl)",
          position: "relative",
          zIndex: 1,
          backgroundImage: "linear-gradient(135deg, rgba(10, 10, 16, 0.95) 0%, rgba(20, 20, 32, 0.9) 100%), url('/images/hero_stadium.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
        variants={HERO_REVEAL_VARIANTS}
        initial={isReduced ? false : "hidden"}
        animate="visible"
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-sm)",
            marginBottom: "var(--space-md)",
          }}
        >
          <span className="ds-chip" style={{ background: "#0071e3", color: "#ffffff" }}>
            {CATEGORY_LABEL[story.category] ?? story.category}
          </span>
          {story.match_format && (
            <span className="ds-chip" style={{ background: "rgba(255, 255, 255, 0.15)", color: "#ffffff" }}>
              {story.match_format}
            </span>
          )}
          {story.year && (
            <span className="text-micro" style={{ margin: 0, color: "rgba(255, 255, 255, 0.7)" }}>
              YEAR {story.year}
            </span>
          )}
        </div>

        <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: "#ffffff", margin: "0 0 var(--space-md) 0", lineHeight: 1.15, letterSpacing: "-0.02em" }}>
          {story.title}
        </h1>
        <p style={{ margin: 0, fontSize: "var(--text-base)", color: "rgba(255, 255, 255, 0.85)", lineHeight: 1.6, maxWidth: 640 }}>
          {story.summary}
        </p>
      </motion.div>

      {/* Story Beats Section */}
      <div style={{ position: "relative", zIndex: 1, marginBottom: "var(--space-xl)" }}>
        <StoryBeats segments={story.segments} />
      </div>

      {/* Tags & Metadata */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-sm)",
          margin: "var(--space-xl) 0",
          position: "relative",
          zIndex: 1,
        }}
      >
        {story.teams.map((t) => (
          <span key={`team-${t}`} className="ds-chip ds-chip-category">
            {t}
          </span>
        ))}
        {story.players.map((p) => (
          <span key={`player-${p}`} className="ds-chip ds-chip-category">
            {p}
          </span>
        ))}
        {story.venue && (
          <span className="ds-chip ds-chip-category">
            {story.venue}
          </span>
        )}
        {story.tags.map((t) => (
          <Link key={`tag-${t}`} href={`/stories?tag=${encodeURIComponent(t)}`} className="ds-chip" style={{ background: "#000000", color: "#ffffff", textDecoration: "none" }}>
            #{t}
          </Link>
        ))}
      </div>

      <div
        className="text-micro"
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "var(--space-lg)",
          position: "relative",
          zIndex: 1,
        }}
      >
        <span>
          Source: {story.source_type}
          {story.source_ref &&
            (sourceIsLink ? (
              <>
                {" "}
                (
                <a href={story.source_ref} target="_blank" rel="noreferrer" style={{ color: "#0071e3" }}>
                  {story.source_ref}
                </a>
                )
              </>
            ) : (
              ` (${story.source_ref})`
            ))}
        </span>
        <span>#TheCricketFan</span>
      </div>

      <button
        onClick={handleDownload}
        disabled={exporting}
        className="ds-btn-pill ds-btn-pill-dark"
        style={{ marginBottom: "var(--space-xl)", position: "relative", zIndex: 1 }}
      >
        {exporting ? "Rendering..." : "Download PNG Card ↗"}
      </button>

      {(prev || next) && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-md)", position: "relative", zIndex: 1 }}>
          {prev ? (
            <Link href={`/stories/${encodeURIComponent(prev.content_key)}`} className="ds-btn-pill ds-btn-pill-light" style={{ textDecoration: "none" }}>
              ← {truncate(prev.title, 36)}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={`/stories/${encodeURIComponent(next.content_key)}`} className="ds-btn-pill ds-btn-pill-light" style={{ textDecoration: "none" }}>
              {truncate(next.title, 36)} →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}

      {/* Off-screen card wrapper for html-to-image capture */}
      <div style={{ position: "fixed", left: -20000, top: 0 }} aria-hidden>
        <div ref={cardRef}>
          <StoryCardImg story={story} />
        </div>
      </div>
    </motion.div>
  );
}
