"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Story, storiesApi } from "@/lib/storiesApi";
import StoryBeats from "@/components/stories/StoryBeats";

// Mirrors StoryCard.tsx's local CATEGORY_LABEL map — not exported there, so
// duplicated here rather than reaching into a sibling component's internals.
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

  const containerStyle = { maxWidth: 680, margin: "0 auto", padding: "var(--space-xl) var(--space-lg)" };

  if (notFound) {
    return (
      <div style={{ ...containerStyle, textAlign: "center" }}>
        <p className="text-micro" style={{ margin: "0 0 var(--space-md) 0" }}>
          STORY NOT FOUND
        </p>
        <Link href="/stories" className="ds-nav-link">
          ← The Vault
        </Link>
      </div>
    );
  }

  if (!story) {
    return (
      <div style={containerStyle}>
        <div className="ds-skeleton" style={{ maxWidth: 680 }} />
      </div>
    );
  }

  const idx = siblings.findIndex((s) => s.content_key === key);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;
  const sourceIsLink = story.source_ref?.startsWith("http");

  return (
    <div style={containerStyle}>
      <Link href="/stories" className="ds-nav-link" style={{ display: "inline-block", marginBottom: "var(--space-lg)" }}>
        ← The Vault
      </Link>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-sm)",
          marginBottom: "var(--space-md)",
        }}
      >
        <span className="ds-chip ds-chip-category">
          {CATEGORY_LABEL[story.category] ?? story.category}
        </span>
        {story.match_format && <span className="ds-chip">{story.match_format}</span>}
        {story.year && (
          <span className="text-micro" style={{ margin: 0 }}>
            {story.year}
          </span>
        )}
      </div>

      <h1 className="text-tool-headline" style={{ margin: "0 0 var(--space-sm) 0" }}>
        {story.title}
      </h1>
      <p style={{ margin: "0 0 var(--space-xl) 0", fontSize: 16, color: "var(--muted)" }}>
        {story.summary}
      </p>

      <StoryBeats segments={story.segments} />

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-sm)",
          margin: "var(--space-xl) 0",
        }}
      >
        {story.teams.map((t) => (
          <span key={`team-${t}`} className="ds-chip">
            {t}
          </span>
        ))}
        {story.players.map((p) => (
          <span key={`player-${p}`} className="ds-chip">
            {p}
          </span>
        ))}
        {story.venue && <span className="ds-chip">{story.venue}</span>}
        {story.tags.map((t) => (
          <Link key={`tag-${t}`} href={`/stories?tag=${encodeURIComponent(t)}`} className="ds-chip">
            #{t}
          </Link>
        ))}
      </div>

      <div
        className="text-micro"
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "var(--space-xl)",
        }}
      >
        <span>
          Source: {story.source_type}
          {story.source_ref &&
            (sourceIsLink ? (
              <>
                {" "}
                (
                <a href={story.source_ref} target="_blank" rel="noreferrer">
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

      {(prev || next) && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-md)" }}>
          {prev ? (
            <Link href={`/stories/${encodeURIComponent(prev.content_key)}`} className="ds-btn-secondary">
              ← {truncate(prev.title, 40)}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={`/stories/${encodeURIComponent(next.content_key)}`} className="ds-btn-secondary">
              {truncate(next.title, 40)} →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
