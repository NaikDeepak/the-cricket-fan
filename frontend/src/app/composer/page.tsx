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
      {/* Apple Hero Header Banner with Titanium Render */}
      <motion.div
        className="ds-spatial-card-dark"
        variants={HERO_REVEAL_VARIANTS}
        initial={isReduced ? false : "hidden"}
        animate="visible"
        style={{
          borderRadius: 24,
          padding: "var(--space-xl)",
          marginBottom: "var(--space-xl)",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--space-xl)",
          alignItems: "center",
          backgroundImage: "linear-gradient(135deg, rgba(10, 10, 14, 0.95) 0%, rgba(20, 20, 30, 0.9) 100%)",
        }}
      >
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: "var(--space-xs)" }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--wire-red)",
                boxShadow: "0 0 8px var(--wire-red)",
              }}
            />
            <span className="text-micro" style={{ color: "rgba(255, 255, 255, 0.7)" }}>
              PRESS BOX COMPOSER STUDIO
            </span>
          </div>

          <h1
            style={{
              fontSize: "var(--text-2xl)",
              fontWeight: 700,
              color: "#ffffff",
              margin: "var(--space-xs) 0 var(--space-sm) 0",
              letterSpacing: "-0.02em",
              lineHeight: 1.15,
            }}
          >
            Craft High-Fidelity Cricket Match Content.
          </h1>

          <p
            style={{
              fontSize: "var(--text-base)",
              color: "rgba(255, 255, 255, 0.8)",
              lineHeight: 1.6,
              margin: 0,
              maxWidth: 460,
            }}
          >
            Draft stories, records, and predictions from content bank or AI generators. Edit copy, select card themes, and export high-resolution PNG assets.
          </p>
        </div>

        {/* Product photography render overlay */}
        <div style={{ borderRadius: 16, overflow: "hidden", boxShadow: "0 16px 40px rgba(0,0,0,0.5)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/composer_hero.jpg"
            alt="Cricket Titanium Render"
            style={{ width: "100%", height: 200, objectFit: "cover", display: "block" }}
          />
        </div>
      </motion.div>

      {/* Main Composer Tool Grid */}
      <div className="composer-grid">
        <div>
          <h2 className="text-title" style={{ marginBottom: "var(--space-md)", color: "#000000", fontSize: "var(--text-xl)" }}>
            Drafts &amp; Generators
          </h2>
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
          <h2 className="text-title" style={{ color: "#000000", fontSize: "var(--text-xl)" }}>
            Editor &amp; Preview
          </h2>
          {selected ? (
            <div
              key={selected.id}
              style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}
            >
              <Editor draft={selected} onChange={handleUpdated} />
              <CardPreview
                draft={selected}
                onUpdate={handleUpdated}
                onDelete={handleDeleted}
                onDuplicate={handleCreated}
              />
            </div>
          ) : (
            <div
              className="ds-card"
              style={{
                cursor: "default",
                textAlign: "center",
                padding: "var(--space-xl) var(--space-md)",
                background: "#ffffff",
                borderRadius: 16,
              }}
            >
              <p style={{ margin: 0, color: "var(--fg-muted)", fontSize: "var(--text-sm)" }}>
                Select or create a draft to start editing.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
