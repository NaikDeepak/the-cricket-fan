"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import gsap from "gsap";
import { Story, WireItem, storiesApi, todayMonthDay } from "@/lib/storiesApi";
import StoryCard from "@/components/stories/StoryCard";
import OnThisDayRail from "@/components/stories/OnThisDayRail";
import WireStrip from "@/components/stories/WireStrip";
import { prefersReducedMotion } from "@/lib/motion";
import {
  filtersFromSearchParams,
  nextFiltersOnTagSelect,
  resolveQSync,
  storiesUrl,
} from "@/lib/storiesFilters";

function Vault() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = filtersFromSearchParams(searchParams);
  const activeTag = filters.tag;

  const [qInput, setQInput] = useState(filters.q);
  const [stories, setStories] = useState<Story[]>([]);
  const [wire, setWire] = useState<WireItem[]>([]);
  const [loading, setLoading] = useState(true);
  const gridRef = useRef<HTMLDivElement>(null);

  // Tracks the last `q` value *this component* pushed into the URL (via the
  // debounce below or a tag click carrying qInput). Lets the resync effect
  // tell "the URL changed because we pushed it" apart from "the URL changed
  // out from under us" (back/forward, a tag click carrying newer text).
  const lastPushedQ = useRef(filters.q);

  // The URL is the source of truth for `q`. When it changes for a reason
  // other than this component's own debounce push — browser back/forward,
  // or a tag click that carried a newer qInput — resync the local buffer so
  // it doesn't silently overwrite the URL 300ms later with stale text.
  useEffect(() => {
    const sync = resolveQSync(filters.q, lastPushedQ.current);
    if (sync) {
      lastPushedQ.current = sync.lastPushedQ;
      setQInput(sync.qInput);
    }
  }, [filters.q]);

  // Debounce the typed query into the URL — URL stays the single source of truth.
  useEffect(() => {
    const id = setTimeout(() => {
      const nextUrl = storiesUrl({ q: qInput, tag: filters.tag });
      const currentUrl = storiesUrl({ q: filters.q, tag: filters.tag });
      if (nextUrl !== currentUrl) {
        lastPushedQ.current = qInput;
        router.replace(nextUrl, { scroll: false });
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

  // Fetch the wire strip once — it's independent of the search query. An
  // API error here must not blank the vault, so failures resolve to [].
  useEffect(() => {
    let cancelled = false;
    storiesApi
      .getWire()
      .catch(() => [])
      .then((data) => {
        if (!cancelled) setWire(data);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const allTags = Array.from(new Set(stories.flatMap((s) => s.tags || [])));

  const filteredStories = activeTag
    ? stories.filter((s) => s.tags?.includes(activeTag))
    : stories;

  // Vault grid stagger — independent of the q/URL-sync effects above.
  useEffect(() => {
    if (prefersReducedMotion() || !gridRef.current) return;
    const cards = gridRef.current.children;
    if (cards.length === 0) return;
    const ctx = gsap.context(() => {
      gsap.from(cards, {
        opacity: 0,
        y: 16,
        duration: 0.35,
        stagger: 0.04,
        ease: "power4.out",
        clearProps: "all",
      });
    }, gridRef);
    return () => ctx.revert();
    // `filteredStories` is a fresh array reference on every render whenever
    // activeTag is set (stories.filter allocates), which would re-fire this
    // on every keystroke via qInput-driven re-renders. Depend on the actual
    // primitives that determine "stories/filter changed" instead.
  }, [stories, activeTag]);

  const showRails = !filters.q && !activeTag;
  const onThisDay = stories.filter((s) => s.event_month_day === todayMonthDay());

  function selectTag(tag: string | null) {
    // Carry the live qInput (not stale filters.q) so a tag click mid-debounce
    // doesn't discard text the user just typed but hasn't committed yet.
    const next = nextFiltersOnTagSelect(qInput, activeTag, tag);
    const nextUrl = storiesUrl(next);
    lastPushedQ.current = next.q;
    if (nextUrl !== storiesUrl(filters)) {
      router.replace(nextUrl, { scroll: false });
    }
  }

  function clearFilters() {
    lastPushedQ.current = "";
    setQInput("");
    if (storiesUrl(filters) !== "/stories") {
      router.replace("/stories", { scroll: false });
    }
  }

  const hasActiveFilter = Boolean(filters.q || activeTag);

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

      {showRails && (
        <>
          <OnThisDayRail stories={onThisDay} />
          <WireStrip items={wire} />
        </>
      )}

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
          {hasActiveFilter && (
            <button
              type="button"
              onClick={clearFilters}
              className="ds-btn-secondary"
              style={{ marginTop: "var(--space-md)" }}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div
          ref={gridRef}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "var(--space-md)",
          }}
        >
          {filteredStories.map((story) => (
            <Link
              key={story.content_key}
              href={`/stories/${encodeURIComponent(story.content_key)}`}
              style={{ textDecoration: "none" }}
            >
              <StoryCard story={story} />
            </Link>
          ))}
        </div>
      )}
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
