"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Story, storiesApi } from "@/lib/storiesApi";
import { StoryCardModal } from "@/components/stories/StoryCardModal";
import StoryCard from "@/components/stories/StoryCard";
import {
  filtersFromSearchParams,
  queryStringFromFilters,
  type VaultFilters,
} from "@/lib/storiesFilters";

function Vault() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = filtersFromSearchParams(searchParams);
  const activeTag = filters.tag;

  const [qInput, setQInput] = useState(filters.q);
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);

  // Debounce the typed query into the URL — URL stays the single source of truth.
  useEffect(() => {
    const id = setTimeout(() => {
      if (qInput !== filters.q) {
        const next: VaultFilters = { q: qInput, tag: filters.tag };
        router.replace("/stories" + queryStringFromFilters(next), { scroll: false });
      }
    }, 300);
    return () => clearTimeout(id);
  }, [qInput, filters.q, filters.tag, router]);

  // Refetch whenever the committed (URL) query changes.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await storiesApi.listStories({ search: filters.q || undefined });
        if (!cancelled) setStories(data);
      } catch (err) {
        console.error("Failed to load stories:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [filters.q]);

  const allTags = Array.from(new Set(stories.flatMap((s) => s.tags || [])));

  const filteredStories = activeTag
    ? stories.filter((s) => s.tags?.includes(activeTag))
    : stories;

  function selectTag(tag: string | null) {
    const next: VaultFilters = { q: filters.q, tag: tag === activeTag ? null : tag };
    router.replace("/stories" + queryStringFromFilters(next), { scroll: false });
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "var(--space-lg)" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "var(--space-md)",
          marginBottom: "var(--space-xl)",
        }}
      >
        <div>
          <span className="text-micro">THE CRICKET FAN</span>
          <h1 className="text-tool-headline" style={{ margin: "var(--space-xs) 0" }}>
            The Vault
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>
            Real, verified cricket folklore — comebacks, records, and turning points.
          </p>
        </div>
        <Link href="/composer" className="ds-nav-link">
          Composer →
        </Link>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-md)",
          marginBottom: "var(--space-xl)",
        }}
      >
        <input
          type="text"
          className="ds-input"
          placeholder="Search by player, team, rivalry, or keyword…"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          style={{ width: "100%" }}
        />

        {allTags.length > 0 && (
          <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => selectTag(null)}
              className="ds-chip"
              style={{
                border: `1px solid ${activeTag === null ? "var(--wire-red)" : "var(--border)"}`,
                cursor: "pointer",
                background: activeTag === null ? "var(--wire-red)" : "var(--surface)",
                color: activeTag === null ? "#fff" : "var(--fg)",
              }}
            >
              All Stories
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => selectTag(tag)}
                className="ds-chip"
                style={{
                  border: `1px solid ${activeTag === tag ? "var(--wire-red)" : "var(--border)"}`,
                  cursor: "pointer",
                  background: activeTag === tag ? "var(--wire-red)" : "var(--surface)",
                  color: activeTag === tag ? "#fff" : "var(--fg)",
                }}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "var(--space-md)",
          }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="ds-skeleton" />
          ))}
        </div>
      ) : filteredStories.length === 0 ? (
        <div style={{ textAlign: "center", padding: "var(--space-xl) 0" }}>
          <p className="text-micro" style={{ margin: 0 }}>
            NOTHING IN THE VAULT FOR THAT FILTER
          </p>
          <p style={{ marginTop: "var(--space-sm)", color: "var(--muted)", fontSize: 14 }}>
            Try clearing the search or tag filter to see more of the vault.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "var(--space-md)",
          }}
        >
          {filteredStories.map((story) => (
            <div key={story.content_key} onClick={() => setSelectedStory(story)}>
              <StoryCard story={story} />
            </div>
          ))}
        </div>
      )}

      <StoryCardModal story={selectedStory} onClose={() => setSelectedStory(null)} />
    </div>
  );
}

export default function StoriesPage() {
  return (
    <Suspense fallback={null}>
      <Vault />
    </Suspense>
  );
}
