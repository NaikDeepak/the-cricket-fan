import type { Story } from "@/lib/storiesApi";

const CATEGORY_LABEL: Record<string, string> = {
  wiki_record: "RECORD",
  anecdote: "ANECDOTE",
  story: "STORY",
};

export default function StoryCardImg({ story }: { story: Story }) {
  const keyLine = story.segments[0] || story.summary || "";
  const stamp = [story.year, story.venue].filter(Boolean).join(" · ");
  return (
    <div
      style={{
        width: 1080,
        height: 1350,
        background: "linear-gradient(160deg, #0a0a0a 0%, #1a0d0b 100%)",
        color: "#ffffff",
        padding: 64,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        boxSizing: "border-box",
        fontFamily: "'Space Grotesk', sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "2px solid #2a2a2a",
          paddingBottom: 28,
        }}
      >
        <span
          style={{
            fontSize: 26,
            letterSpacing: 4,
            fontWeight: 700,
            color: "#e8432e",
          }}
        >
          {CATEGORY_LABEL[story.category] ?? story.category.toUpperCase()}
        </span>
        {stamp && (
          <span style={{ fontSize: 24, color: "#a3a3a3" }}>{stamp}</span>
        )}
      </div>

      <div style={{ margin: "40px 0" }}>
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            lineHeight: 1.1,
            marginBottom: 32,
          }}
        >
          {story.title}
        </div>
        <p style={{ fontSize: 34, lineHeight: 1.45, color: "#e5e5e5", margin: 0 }}>
          {keyLine}
        </p>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "2px solid #2a2a2a",
          paddingTop: 28,
          fontSize: 24,
          color: "#a3a3a3",
        }}
      >
        <span>THE CRICKET FAN</span>
        <span style={{ color: "#5dc4d9" }}>#TheCricketFan</span>
      </div>
    </div>
  );
}
