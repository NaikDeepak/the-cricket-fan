"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Story, WireItem, storiesApi, todayMonthDay } from "@/lib/storiesApi";
import StoryCard from "@/components/stories/StoryCard";
import OnThisDayRail from "@/components/stories/OnThisDayRail";
import WireStrip from "@/components/stories/WireStrip";
import {
  HERO_REVEAL_VARIANTS,
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

  const showRails = !filters.q && !activeTag && !activeSource;
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

  const hasActiveFilter = Boolean(filters.q || activeTag || activeSource);

  return (
    <motion.div
      initial={isReduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={{ maxWidth: 1200, margin: "0 auto", padding: "0 var(--space-lg) var(--space-xl)" }}
    >
      {/* Apple Vision Pro Header Navigation Bar */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "var(--space-md) 0 var(--space-xl)",
          borderBottom: "1px solid var(--border)",
          marginBottom: "var(--space-xl)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
          <Link href="/stories" style={{ textDecoration: "none" }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: "#000000", letterSpacing: "-0.03em" }}>
              TCF.
            </span>
          </Link>
          <span className="text-micro" style={{ background: "#e8e8ed", padding: "4px 12px", borderRadius: 999 }}>
            The Cricket Fan
          </span>
        </div>

        <nav style={{ display: "flex", alignItems: "center", gap: "var(--space-lg)" }}>
          <Link href="/stories" className="ds-nav-link" style={{ color: "#000000", fontWeight: 700 }}>
            The Vault
          </Link>
          <Link href="/composer" className="ds-nav-link">
            Composer
          </Link>
          <Link href="/composer" className="ds-btn-pill ds-btn-pill-dark" style={{ textDecoration: "none" }}>
            Contact Us ↗
          </Link>
        </nav>
      </header>

      {/* Apple Vision Pro Hero Section */}
      <motion.section
        variants={HERO_REVEAL_VARIANTS}
        initial={isReduced ? false : "hidden"}
        animate="visible"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--space-xl)",
          alignItems: "center",
          marginBottom: "var(--space-xl)",
        }}
      >
        <div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              marginBottom: "var(--space-md)",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "#000000",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              🏏
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#000000" }}>The Cricket Fan</div>
              <div style={{ fontSize: 11, color: "var(--fg-muted)" }}>Revolution in match storytelling</div>
            </div>
          </div>

          <h1
            className="text-hero-headline"
            style={{
              marginBottom: "var(--space-md)",
            }}
          >
            Seamlessly Blends Digital Cricket Folklore With Your Physical Space.
          </h1>

          <p
            style={{
              fontSize: "var(--text-base)",
              lineHeight: 1.6,
              color: "var(--fg-muted)",
              marginBottom: "var(--space-xl)",
              maxWidth: 480,
            }}
          >
            Explore verified match comeback stories, iconic player rivalry statistics, and turning-point beats in ultra-high fidelity visual cards.
          </p>

          <div style={{ display: "flex", gap: "var(--space-md)", alignItems: "center" }}>
            <a href="#vault-grid" className="ds-btn-pill ds-btn-pill-dark" style={{ textDecoration: "none" }}>
              Explore Vault ↗
            </a>
            <button
              type="button"
              onClick={() => selectTag("rivalry")}
              className="ds-btn-pill ds-btn-pill-light"
            >
              Rivalries ↗
            </button>
          </div>
        </div>

        {/* Hero Stadium Visual Graphic Panel */}
        <div style={{ position: "relative" }}>
          <div
            style={{
              borderRadius: 24,
              overflow: "hidden",
              boxShadow: "0 24px 60px rgba(0, 0, 0, 0.12)",
              border: "1px solid rgba(0, 0, 0, 0.08)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/hero_stadium.jpg"
              alt="Cricket Stadium Masterpiece"
              style={{
                width: "100%",
                height: 380,
                objectFit: "cover",
                display: "block",
              }}
            />
          </div>

          {/* Floating Dark Spatial Card anchored over hero image */}
          <div
            className="ds-spatial-card-dark"
            style={{
              position: "absolute",
              bottom: -24,
              left: 24,
              right: 24,
              padding: "var(--space-md) var(--space-lg)",
              borderRadius: 16,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              backdropFilter: "blur(20px)",
              background: "rgba(10, 10, 14, 0.88)",
            }}
          >
            <div>
              <span className="text-micro" style={{ color: "rgba(255, 255, 255, 0.6)" }}>
                MATCH OF THE MOMENT • NEW
              </span>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#ffffff", marginTop: 2 }}>
                Sharjah 1986 — Miandad&apos;s Last-Ball Six
              </div>
            </div>
            <Link href="/stories/story%3Asharjah-1986-miandad-six" className="ds-btn-pill ds-btn-pill-accent" style={{ fontSize: 12, padding: "6px 16px" }}>
              Explore ↗
            </Link>
          </div>
        </div>
      </motion.section>

      {showRails && (
        <div style={{ marginTop: "var(--space-xl)" }}>
          <OnThisDayRail stories={activeOnThisDay} />
          <WireStrip items={wire} />
        </div>
      )}

      {/* Vault Section & Filter Controls */}
      <div id="vault-grid" style={{ paddingTop: "var(--space-xl)", marginBottom: "var(--space-lg)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "var(--space-md)" }}>
          <div>
            <span className="text-micro">EXPLORE ARCHIVE</span>
            <h2 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, margin: "4px 0 0 0", letterSpacing: "-0.02em" }}>
              Stories &amp; Turning Points
            </h2>
          </div>
          <span className="text-caption" style={{ margin: 0 }}>
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
              { id: null, label: "All Sources", icon: "🏏" },
              { id: "wikipedia", label: "Wikipedia Archive", icon: "🏛️" },
              { id: "reddit", label: "r/Cricket Lore", icon: "👾" },
              { id: "memoir", label: "Dressing Room & Memoirs", icon: "📖" },
              { id: "cricsheet", label: "Match Thrillers", icon: "⚡" },
            ].map((tab) => {
              const isActive = activeSource === tab.id;
              return (
                <button
                  key={tab.label}
                  type="button"
                  onClick={() => selectSource(tab.id)}
                  className="ds-btn-pill"
                  style={{
                    fontSize: 13,
                    padding: "6px 16px",
                    cursor: "pointer",
                    background: isActive ? "#000000" : "rgba(0, 0, 0, 0.05)",
                    color: isActive ? "#ffffff" : "#1d1d1f",
                    border: `1px solid ${isActive ? "#000000" : "transparent"}`,
                    fontWeight: isActive ? 700 : 500,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    transition: "all 0.15s ease",
                  }}
                >
                  <span>{tab.icon}</span>
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
            style={{ width: "100%" }}
          />

          {allTags.length > 0 && (
            <div className="ds-tag-scroll">
              <button
                type="button"
                onClick={() => selectTag(null)}
                className="ds-chip"
                style={{
                  border: `1px solid ${activeTag === null ? "#000000" : "var(--border)"}`,
                  cursor: "pointer",
                  background: activeTag === null ? "#000000" : "var(--surface)",
                  color: activeTag === null ? "#ffffff" : "var(--fg)",
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
                    border: `1px solid ${activeTag === tag ? "#000000" : "var(--border)"}`,
                    cursor: "pointer",
                    background: activeTag === tag ? "#000000" : "var(--surface)",
                    color: activeTag === tag ? "#ffffff" : "var(--fg)",
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
