"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import CardPreview from "@/components/composer/CardPreview";
import Editor from "@/components/composer/Editor";
import Feed from "@/components/composer/Feed";
import { composerApi, type Draft } from "@/lib/composerApi";
import { HERO_REVEAL_VARIANTS, prefersReducedMotion } from "@/lib/motion";

export default function ComposerPage() {
  return (
    <Suspense fallback={<div style={{ padding: "var(--space-xl)", color: "var(--fg-muted)" }}>Loading Composer Studio…</div>}>
      <ComposerContent />
    </Suspense>
  );
}

function ComposerContent() {
  const searchParams = useSearchParams();
  const draftIdParam = searchParams.get("draft_id");

  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Draft | null>(null);
  const isReduced = prefersReducedMotion();

  useEffect(() => {
    composerApi
      .listDrafts()
      .then(async (d) => {
        setDrafts(d);
        setLoadError(null);

        if (draftIdParam) {
          const targetId = Number(draftIdParam);
          const found = d.find((x) => x.id === targetId);
          if (found) {
            setSelected(found);
          } else {
            try {
              const fetched = await composerApi.getDraft(targetId);
              setDrafts((prev) => [fetched, ...prev]);
              setSelected(fetched);
            } catch {
              // ignore fetch error if draft doesn't exist
            }
          }
        }
      })
      .catch(() =>
        setLoadError(
          "Could not reach the composer API. Is it running (uvicorn composer.app:app) on the URL in NEXT_PUBLIC_API_URL?"
        )
      )
      .finally(() => setLoading(false));
  }, [draftIdParam]);

  const handleCreated = useCallback((d: Draft) => {
    setDrafts((prev) => [d, ...prev]);
    setSelected(d);
  }, []);

  const handleUpdated = useCallback((d: Draft) => {
    setDrafts((prev) => prev.map((x) => (x.id === d.id ? d : x)));
    setSelected(d);
  }, []);

  const handleDeleted = useCallback((id: number) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    setSelected(null);
  }, []);

  return (
    <div>
      {/* Apple Hero Header Banner */}
      <motion.div
        className="ds-card"
        variants={HERO_REVEAL_VARIANTS}
        initial={isReduced ? false : "hidden"}
        animate="visible"
        style={{
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-lg) var(--space-xl)",
          marginBottom: "var(--space-lg)",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--space-xl)",
          alignItems: "center",
          background: "#111114",
          color: "#ffffff",
          border: "1px solid rgba(255, 255, 255, 0.12)",
        }}
      >
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: "var(--space-xs)" }}>
            <span
              className="ds-badge"
              style={{
                background: "rgba(255, 255, 255, 0.1)",
                color: "#ffffff",
                border: "1px solid rgba(255, 255, 255, 0.15)",
              }}
            >
              Press Box Studio
            </span>
          </div>

          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#ffffff",
              margin: "var(--space-xs) 0 var(--space-sm) 0",
              letterSpacing: "-0.02em",
              lineHeight: 1.25,
            }}
          >
            Craft Match Content &amp; Shareables.
          </h1>

          <p
            style={{
              fontSize: 13,
              color: "#a1a1aa",
              lineHeight: 1.55,
              margin: 0,
              maxWidth: 480,
            }}
          >
            Draft stories, records, and predictions from the content bank or AI generators. Customize copy, apply official team palettes, and export high-resolution PNG cards.
          </p>
        </div>

        {/* Product photography render overlay */}
        <div style={{ borderRadius: "var(--radius-md)", overflow: "hidden", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/composer_hero.jpg"
            alt="Cricket Titanium Render"
            style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }}
          />
        </div>
      </motion.div>

      {/* Main Composer Tool Grid */}
      <div className="composer-grid">
        <div>
          <Feed
            drafts={drafts}
            loading={loading}
            loadError={loadError}
            onCreated={handleCreated}
            onSelect={setSelected}
            selectedId={selected?.id}
          />
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-md)",
          }}
        >
          {selected ? (
            <>
              <Editor draft={selected} onChange={handleUpdated} />
              <CardPreview
                draft={selected}
                onUpdate={handleUpdated}
                onDelete={handleDeleted}
                onDuplicate={handleCreated}
              />
            </>
          ) : (
            <div
              className="ds-card"
              style={{
                padding: "var(--space-xl)",
                textAlign: "center",
                background: "#ffffff",
                color: "var(--fg-muted)",
              }}
            >
              <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "var(--fg)" }}>
                No draft selected
              </p>
              <p className="text-caption" style={{ marginTop: 4 }}>
                Select a draft from the queue on the left or generate a new card.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
