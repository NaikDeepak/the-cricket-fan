"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Story, WireItem, storiesApi } from "@/lib/storiesApi";
import StoryCard from "@/components/stories/StoryCard";
import OnThisDayRail from "@/components/stories/OnThisDayRail";
import WireStrip from "@/components/stories/WireStrip";
import StadiumTacticalCanvas from "@/components/stories/StadiumTacticalCanvas";
import AppleGlobalNav from "@/components/common/AppleGlobalNav";
import {
  STAGGER_CONTAINER_VARIANTS,
  prefersReducedMotion,
} from "@/lib/motion";
import {
  filtersFromSearchParams,
  nextFiltersOnSourceSelect,
  nextFiltersOnTagSelect,
  resolveQSync,
  storiesUrl,
} from "@/lib/storiesFilters";

function Vault() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = filtersFromSearchParams(searchParams);
  const activeTag = filters.tag;
  const activeSource = filters.source || null;

  const [qInput, setQInput] = useState(filters.q);
  const [stories, setStories] = useState<Story[]>([]);
  const [wire, setWire] = useState<WireItem[]>([]);
  const [onThisDay, setOnThisDay] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  const lastPushedQ = useRef(filters.q);
  const isReduced = prefersReducedMotion();

  useEffect(() => {
    const sync = resolveQSync(filters.q, lastPushedQ.current);
    if (sync) {
      lastPushedQ.current = sync.lastPushedQ;
      setQInput(sync.qInput);
    }
  }, [filters.q]);

  useEffect(() => {
    const id = setTimeout(() => {
      const nextUrl = storiesUrl({ q: qInput, tag: filters.tag, source: filters.source });
      const currentUrl = storiesUrl({ q: filters.q, tag: filters.tag, source: filters.source });
      if (nextUrl !== currentUrl) {
        lastPushedQ.current = qInput;
        router.replace(nextUrl, { scroll: false });
      }
    }, 300);
    return () => clearTimeout(id);
  }, [qInput, filters.q, filters.tag, filters.source, router]);

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

  useEffect(() => {
    let cancelled = false;
    storiesApi
      .getWire()
      .catch(() => [])
      .then((data) => {
        if (!cancelled) setWire(data);
      });
    storiesApi
      .getOnThisDay()
      .catch(() => null)
      .then((otd) => {
        if (!cancelled && otd) {
          setOnThisDay((prev) => (prev.length === 0 ? [otd] : prev));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const allTags = Array.from(new Set(stories.flatMap((s) => s.tags || [])));

  const filteredStories = useMemo(() => {
    return stories.filter((s) => {
      if (activeTag && !(s.tags || []).includes(activeTag)) return false;
      if (activeSource && (s.source_type || "").toLowerCase() !== activeSource.toLowerCase()) {
        return false;
      }
      return true;
    });
  }, [stories, activeTag, activeSource]);

  const activeOnThisDay = useMemo(() => {
    return onThisDay;
  }, [onThisDay]);

  function selectTag(t: string | null) {
    const next = nextFiltersOnTagSelect(qInput, activeTag, t, activeSource);
    lastPushedQ.current = next.q;
    router.replace(storiesUrl(next), { scroll: false });
  }

  function selectSource(src: string | null) {
    const next = nextFiltersOnSourceSelect(qInput, activeSource, src, activeTag);
    lastPushedQ.current = next.q;
    router.replace(storiesUrl(next), { scroll: false });
  }

  function clearFilters() {
    lastPushedQ.current = "";
    setQInput("");
    if (storiesUrl(filters) !== "/stories") {
      router.replace("/stories", { scroll: false });
    }
  }

  const showRails = !filters.q && !activeTag && !activeSource;
  const hasActiveFilter = Boolean(filters.q || activeTag || activeSource);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <AppleGlobalNav />

      <motion.div
        initial={isReduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "var(--space-lg) var(--space-lg) var(--space-2xl)",
        }}
      >
        <div style={{ marginBottom: "var(--space-lg)" }}>
          <StadiumTacticalCanvas stories={stories} />
        </div>

        {showRails && (
          <div style={{ marginTop: "var(--space-lg)" }}>
            <OnThisDayRail stories={activeOnThisDay} />
            <WireStrip items={wire} />
          </div>
        )}

        <div id="vault-grid" style={{ paddingTop: "var(--space-md)", marginBottom: "var(--space-lg)" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              marginBottom: "var(--space-md)",
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  margin: 0,
                  letterSpacing: "-0.02em",
                  color: "var(--fg)",
                }}
              >
                Stories &amp; Turning Points
              </h2>
            </div>
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "var(--fg-muted)",
              }}
            >
              {filteredStories.length} stories
            </span>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-sm)",
              marginBottom: "var(--space-lg)",
            }}
          >
            {/* Source Filter Tabs */}
            <div style={{ display: "flex", gap: "var(--space-xs)", flexWrap: "wrap" }}>
              {[
                { id: null, label: "All Sources" },
                { id: "wikipedia", label: "Wikipedia Archive" },
                { id: "reddit", label: "r/Cricket Lore" },
                { id: "memoir", label: "Dressing Room & Memoirs" },
                { id: "cricsheet", label: "Match Thrillers" },
              ].map((tab) => {
                const isActive = activeSource === tab.id;
                return (
                  <button
                    key={tab.label}
                    type="button"
                    onClick={() => selectSource(tab.id)}
                    className={`ds-filter-tab ${isActive ? "ds-filter-tab--active" : ""}`}
                  >
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <input
              type="text"
              className="ds-input"
              placeholder="Search by player, team, rivalry, or keyword…"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                fontSize: 14,
              }}
            />

            {allTags.length > 0 && (
              <div style={{ display: "flex", gap: "var(--space-xs)", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => selectTag(null)}
                  className={`ds-filter-tab ${activeTag === null ? "ds-filter-tab--active" : ""}`}
                  style={{ fontSize: 12, padding: "4px 10px" }}
                >
                  All Tags
                </button>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => selectTag(tag)}
                    className={`ds-filter-tab ${activeTag === tag ? "ds-filter-tab--active" : ""}`}
                    style={{ fontSize: 12, padding: "4px 10px" }}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Story Card Grid */}
          {loading ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: "var(--space-md)",
              }}
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="ds-skeleton" />
              ))}
            </div>
          ) : filteredStories.length === 0 ? (
            <div className="ds-card" style={{ textAlign: "center", padding: "var(--space-xl)" }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--fg)",
                }}
              >
                No stories match this filter
              </p>
              <p className="text-caption" style={{ marginTop: "var(--space-xs)" }}>
                Try adjusting your search query or removing tag filters.
              </p>
              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="ds-btn ds-btn-secondary"
                  style={{ marginTop: "var(--space-md)" }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <motion.div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: "var(--space-md)",
              }}
              variants={STAGGER_CONTAINER_VARIANTS}
              initial={isReduced ? false : "hidden"}
              animate="visible"
            >
              {filteredStories.map((story, index) => {
                const isFeatured = index === 0;
                return (
                  <motion.div
                    key={story.content_key}
                    style={{
                      gridColumn: isFeatured && filteredStories.length > 1 ? "span 2" : "span 1",
                    }}
                    variants={{
                      hidden: { opacity: 0, y: 12 },
                      visible: { opacity: 1, y: 0 },
                    }}
                  >
                    <Link
                      href={`/stories/${encodeURIComponent(story.content_key)}`}
                      style={{ textDecoration: "none", display: "block", height: "100%" }}
                    >
                      <StoryCard story={story} featured={isFeatured} />
                    </Link>
                  </motion.div>
                );
              })}

              {filteredStories.length < 6 && !hasActiveFilter && (
                <div
                  className="ds-card"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    padding: "24px",
                    textAlign: "center",
                    background: "var(--surface-secondary)",
                    border: "1px dashed var(--border-strong)",
                    minHeight: 200,
                  }}
                >
                  <span className="ds-badge ds-badge-neutral" style={{ marginBottom: 8 }}>
                    MORE STORIES COMING
                  </span>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--fg-muted)" }}>
                    Our team is archiving more classic stories and turning points.
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </motion.div>
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
