"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Story, storiesApi } from "@/lib/storiesApi";
import StoryBeats from "@/components/stories/StoryBeats";
import StoryCardImg from "@/components/stories/StoryCardImg";
import AppleGlobalNav from "@/components/common/AppleGlobalNav";
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

  if (notFound) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <AppleGlobalNav />
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "var(--space-2xl) var(--space-lg)", textAlign: "center" }}>
          <span className="ds-badge ds-badge-danger" style={{ marginBottom: "var(--space-md)" }}>
            Story Not Found
          </span>
          <p className="text-caption" style={{ marginBottom: "var(--space-lg)" }}>
            The story you requested does not exist in the archive.
          </p>
          <Link href="/stories" className="ds-btn ds-btn-primary">
            ← Return to Vault
          </Link>
        </div>
      </div>
    );
  }

  if (!story) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <AppleGlobalNav />
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "var(--space-xl) var(--space-lg)" }}>
          <div className="ds-skeleton" style={{ minHeight: 360 }} />
        </div>
      </div>
    );
  }

  const idx = siblings.findIndex((s) => s.content_key === key);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;
  const sourceIsLink = story.source_ref?.startsWith("http");

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <AppleGlobalNav />

      <motion.main
        style={{ maxWidth: 760, margin: "0 auto", padding: "var(--space-lg) var(--space-lg) var(--space-2xl)" }}
        initial={isReduced ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Navigation Breadcrumb */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-md)" }}>
          <Link href="/stories" className="ds-btn ds-btn-ghost" style={{ fontSize: 13, padding: "4px 8px" }}>
            ← Back to Vault
          </Link>

          <button
            type="button"
            onClick={handleDownload}
            disabled={exporting}
            className="ds-btn ds-btn-secondary"
            style={{ fontSize: 12, padding: "5px 12px" }}
          >
            {exporting ? "Rendering…" : "Download PNG Card"}
          </button>
        </div>

        {/* Spatial Detail Hero Panel */}
        <motion.div
          className="ds-card"
          style={{
            padding: "24px 28px",
            marginBottom: "var(--space-lg)",
            background: "#09090b",
            color: "#ffffff",
            border: "1px solid rgba(255, 255, 255, 0.12)",
          }}
          variants={HERO_REVEAL_VARIANTS}
          initial={isReduced ? false : "hidden"}
          animate="visible"
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: "var(--space-md)",
            }}
          >
            <span
              className="ds-badge"
              style={{
                background: "rgba(255, 255, 255, 0.12)",
                color: "#ffffff",
                border: "1px solid rgba(255, 255, 255, 0.16)",
              }}
            >
              {CATEGORY_LABEL[story.category] ?? story.category}
            </span>
            {story.match_format && (
              <span
                className="ds-badge"
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  color: "#d4d4d8",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                }}
              >
                {story.match_format}
              </span>
            )}
            {story.year && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#a1a1aa",
                  fontVariantNumeric: "tabular-nums",
                  marginLeft: "auto",
                }}
              >
                Year {story.year}
              </span>
            )}
          </div>

          <h1
            style={{
              fontSize: "clamp(22px, 3vw, 30px)",
              fontWeight: 700,
              color: "#ffffff",
              margin: "0 0 var(--space-sm) 0",
              lineHeight: 1.22,
              letterSpacing: "-0.02em",
            }}
          >
            {story.title}
          </h1>

          <p
            style={{
              margin: 0,
              fontSize: 15,
              color: "#a1a1aa",
              lineHeight: 1.6,
            }}
          >
            {story.summary}
          </p>
        </motion.div>

        {/* Story Beats Section */}
        <div style={{ marginBottom: "var(--space-lg)" }}>
          <StoryBeats segments={story.segments} />
        </div>

        {/* Tags & Metadata */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            marginBottom: "var(--space-md)",
          }}
        >
          {story.teams.map((t) => (
            <span key={`team-${t}`} className="ds-badge" style={{ background: "var(--surface-tertiary)", color: "var(--fg-secondary)" }}>
              {t}
            </span>
          ))}
          {story.players.map((p) => (
            <span key={`player-${p}`} className="ds-badge" style={{ background: "var(--surface-tertiary)", color: "var(--fg-secondary)" }}>
              {p}
            </span>
          ))}
          {story.venue && (
            <span className="ds-badge" style={{ background: "var(--surface-tertiary)", color: "var(--fg-secondary)" }}>
              {story.venue}
            </span>
          )}
          {story.tags.map((t) => (
            <Link
              key={`tag-${t}`}
              href={`/stories?tag=${encodeURIComponent(t)}`}
              className="ds-badge"
              style={{
                background: "#000000",
                color: "#ffffff",
                textDecoration: "none",
              }}
            >
              #{t}
            </Link>
          ))}
        </div>

        {/* Source citation */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 0",
            borderTop: "1px solid var(--border)",
            marginBottom: "var(--space-lg)",
            fontSize: 12,
            color: "var(--fg-muted)",
          }}
        >
          <span>
            Source: {story.source_type}
            {story.source_ref &&
              (sourceIsLink ? (
                <>
                  {" "}
                  (
                  <a href={story.source_ref} target="_blank" rel="noreferrer" style={{ color: "var(--apple-blue)" }}>
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

        {/* Prev / Next Story Controls */}
        {(prev || next) && (
          <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-md)" }}>
            {prev ? (
              <Link href={`/stories/${encodeURIComponent(prev.content_key)}`} className="ds-btn ds-btn-secondary" style={{ fontSize: 12 }}>
                ← {truncate(prev.title, 32)}
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link href={`/stories/${encodeURIComponent(next.content_key)}`} className="ds-btn ds-btn-secondary" style={{ fontSize: 12 }}>
                {truncate(next.title, 32)} →
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
      </motion.main>
    </div>
  );
}
