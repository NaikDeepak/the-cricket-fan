import type { Draft } from "@/lib/composerApi";

export default function RecordCardImg({
  draft,
  aspect = "1:1",
}: {
  draft: Draft;
  aspect?: "1:1" | "16:9" | "4:5";
}) {
  const meta = draft.card_meta ?? {};
  const headline = (meta.headline as string) || (meta.stat as string) || "";

  const dims =
    aspect === "16:9"
      ? { width: 1200, height: 675 }
      : aspect === "4:5"
      ? { width: 1080, height: 1350 }
      : { width: 1080, height: 1080 };

  return (
    <div
      style={{
        width: dims.width,
        height: dims.height,
        background: "linear-gradient(135deg, #09090b 0%, #1c1917 100%)",
        color: "#ffffff",
        padding: 48,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        boxSizing: "border-box",
        fontFamily: "var(--font-oswald), sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "2px solid #292524",
          paddingBottom: 24,
        }}
      >
        <span
          style={{
            fontSize: 24,
            letterSpacing: 2,
            color: "#d6d3d1",
            fontWeight: 600,
          }}
        >
          📊 STAT & ANECDOTE
        </span>
        <span
          style={{
            fontSize: 20,
            background: "#292524",
            padding: "6px 16px",
            borderRadius: 20,
            color: "#f5f5f4",
          }}
        >
          {draft.category ? draft.category.toUpperCase() : "FEATURED"}
        </span>
      </div>

      <div style={{ margin: "32px 0" }}>
        {headline && (
          <div
            style={{
              fontSize: 64,
              fontWeight: 800,
              color: "#f59e0b",
              lineHeight: 1.1,
              marginBottom: 24,
            }}
          >
            {headline}
          </div>
        )}
        <p
          style={{
            fontSize: 32,
            fontWeight: 400,
            lineHeight: 1.4,
            color: "#fafaf9",
            margin: 0,
          }}
        >
          {draft.text}
        </p>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "2px solid #292524",
          paddingTop: 24,
          fontSize: 20,
          color: "#a8a29e",
        }}
      >
        <span>THE CRICKET FAN</span>
        <span>#TheCricketFan</span>
      </div>
    </div>
  );
}

