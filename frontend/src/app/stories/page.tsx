"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Story, WireItem, storiesApi, todayMonthDay } from "@/lib/storiesApi";
import StoryCard from "@/components/stories/StoryCard";
import OnThisDayRail from "@/components/stories/OnThisDayRail";
import WireStrip from "@/components/stories/WireStrip";
import StadiumTacticalCanvas from "@/components/stories/StadiumTacticalCanvas";
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
      if (activeSource) {
        const srcType = (s.source_type || "").toLowerCase();
        if (activeSource === "memoir") {
          if (!["memoir", "quora", "interview"].includes(srcType)) return false;
        } else if (!srcType.includes(activeSource)) {
          return false;
        }
      }
      if (activeTag && !s.tags?.includes(activeTag)) {
        return false;
      }
      return true;
    });
  }, [stories, activeSource, activeTag]);

  const activeOnThisDay = useMemo(() => {
    const fromList = stories.filter((s) => s.event_month_day === todayMonthDay());
    return fromList.length > 0 ? fromList : onThisDay;
  }, [stories, onThisDay]);

  function selectTag(tag: string | null) {
    const next = nextFiltersOnTagSelect(qInput, activeTag, tag, activeSource);
    const nextUrl = storiesUrl(next);
    lastPushedQ.current = next.q;
    if (nextUrl !== storiesUrl(filters)) {
      router.replace(nextUrl, { scroll: false });
    }
  }

  function selectSource(source: string | null) {
    const next = nextFiltersOnSourceSelect(qInput, activeSource, source, activeTag);
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

  const showRails = !filters.q && !activeTag && !activeSource;
  const hasActiveFilter = Boolean(filters.q || activeTag || activeSource);

  return (
    <motion.div
      initial={isReduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={{ maxWidth: 1280, margin: "0 auto", padding: "0 var(--space-lg) var(--space-xl)" }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "var(--space-md) 0 var(--space-lg)",
          borderBottom: "1px solid var(--border)",
          marginBottom: "var(--space-lg)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
          <Link href="/stories" style={{ textDecoration: "none" }}>
            <span
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 26,
                fontWeight: 800,
                color: "#0f172a",
                letterSpacing: "-0.02em",
              }}
            >
              The Cricket Fan
            </span>
          </Link>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              background: "#fef3c7",
              color: "#92400e",
              border: "1px solid #fde68a",
              padding: "3px 10px",
              borderRadius: 999,
            }}
          >
            The Vault
          </span>
        </div>

        <nav style={{ display: "flex", alignItems: "center", gap: "var(--space-lg)" }}>
          <Link
            href="/stories"
            className="ds-nav-link"
            style={{
              color: "#0f172a",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            The Vault
          </Link>
          <Link
            href="/predictions"
            className="ds-nav-link"
            style={{
              fontSize: 14,
            }}
          >
            Predictions
          </Link>
          <Link
            href="/composer"
            className="ds-nav-link"
            style={{
              fontSize: 14,
            }}
          >
            Composer
          </Link>
          <Link
            href="/composer"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              fontWeight: 600,
              padding: "8px 18px",
              borderRadius: 999,
              background: "#0f172a",
              color: "#ffffff",
              textDecoration: "none",
              boxShadow: "0 2px 8px rgba(15, 23, 42, 0.15)",
              transition: "all 0.15s ease",
            }}
          >
            Write Story →
          </Link>
        </nav>
      </header>

      <StadiumTacticalCanvas stories={stories} />

      {showRails && (
        <div style={{ marginTop: "var(--space-lg)" }}>
          <OnThisDayRail stories={activeOnThisDay} />
          <WireStrip items={wire} />
        </div>
      )}

      <div id="vault-grid" style={{ paddingTop: "var(--space-xl)", marginBottom: "var(--space-lg)" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginBottom: "var(--space-md)",
          }}
        >
          <div>
            <span className="text-micro" style={{ color: "#d97706" }}>THE ARCHIVE</span>
            <h2
              className="text-editorial-serif"
              style={{
                fontSize: "var(--text-2xl)",
                fontWeight: 700,
                margin: "4px 0 0 0",
                letterSpacing: "-0.01em",
                color: "#0f172a",
              }}
            >
              Stories &amp; Turning Points
            </h2>
          </div>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              fontWeight: 500,
              color: "#64748b",
            }}
          >
            {filteredStories.length} stories available
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-md)",
            marginBottom: "var(--space-xl)",
          }}
        >
          {/* Source Filter Tabs */}
          <div style={{ display: "flex", gap: "var(--space-xs)", flexWrap: "wrap" }}>
            {[
              { id: null, label: "All Sources", accent: "#0f172a" },
              { id: "wikipedia", label: "Wikipedia Archive", accent: "#2563eb" },
              { id: "reddit", label: "r/Cricket Lore", accent: "#ea580c" },
              { id: "memoir", label: "Dressing Room & Memoirs", accent: "#d97706" },
              { id: "cricsheet", label: "Match Thrillers", accent: "#16a34a" },
            ].map((tab) => {
              const isActive = activeSource === tab.id;
              return (
                <button
                  key={tab.label}
                  type="button"
                  onClick={() => selectSource(tab.id)}
                  className={`ds-filter-tab ${isActive ? "ds-filter-tab--active" : ""}`}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      backgroundColor: isActive ? "#ffffff" : tab.accent,
                    }}
                  />
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
              borderRadius: 12,
              borderColor: "#e2e8f0",
              padding: "12px 18px",
              fontSize: 14,
            }}
          />

          {allTags.length > 0 && (
            <div className="ds-tag-scroll">
              <button
                type="button"
                onClick={() => selectTag(null)}
                className="ds-chip"
                style={{
                  border: `1px solid ${activeTag === null ? "#0f172a" : "#e2e8f0"}`,
                  cursor: "pointer",
                  background: activeTag === null ? "#0f172a" : "#ffffff",
                  color: activeTag === null ? "#ffffff" : "#475569",
                  padding: "5px 14px",
                  borderRadius: 999,
                  fontWeight: 600,
                  fontSize: 12,
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
                    border: `1px solid ${activeTag === tag ? "#0f172a" : "#e2e8f0"}`,
                    cursor: "pointer",
                    background: activeTag === tag ? "#0f172a" : "#ffffff",
                    color: activeTag === tag ? "#ffffff" : "#475569",
                    padding: "5px 14px",
                    borderRadius: 999,
                    fontWeight: 600,
                    fontSize: 12,
                  }}
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
              gap: "var(--space-lg)",
            }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="ds-skeleton" />
            ))}
          </div>
        ) : filteredStories.length === 0 ? (
          <div className="ds-card" style={{ textAlign: "center", padding: "var(--space-xl)" }}>
            <p className="text-micro" style={{ margin: 0, color: "var(--wire-red)" }}>
              NOTHING IN THE VAULT FOR THAT FILTER
            </p>
            <p className="text-caption" style={{ marginTop: "var(--space-sm)" }}>
              Try clearing the search query or tag filter to see more of the vault.
            </p>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={clearFilters}
                className="ds-btn-pill ds-btn-pill-dark"
                style={{ marginTop: "var(--space-md)" }}
              >
                Clear filters ↗
              </button>
            )}
          </div>
        ) : (
          <motion.div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: "var(--space-lg)",
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
                    hidden: { opacity: 0, y: 16 },
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

            {filteredStories.length < 6 && (
              <motion.div
                className="ds-card"
                style={{
                  padding: "var(--space-lg)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  minHeight: 180,
                  borderStyle: "dashed",
                  borderColor: "var(--border)",
                  background: "transparent",
                }}
                variants={{
                  hidden: { opacity: 0, y: 16 },
                  visible: { opacity: 1, y: 0 },
                }}
              >
                <p className="text-tool-headline" style={{ margin: 0, fontSize: "var(--text-xl)", color: "var(--fg-muted)" }}>
                  MORE STORIES COMING
                </p>
                <p className="text-caption" style={{ margin: "var(--space-sm) 0 0 0" }}>
                  The vault grows with every match — check back soon.
                </p>
              </motion.div>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

export default function StoriesPage() {
  return (
    <Suspense fallback={null}>
      <Vault />
    </Suspense>
  );
}
