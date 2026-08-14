import type { Story } from "@/lib/storiesApi";

const CATEGORY_LABEL: Record<string, string> = {
  wiki_record: "Record",
  anecdote: "Anecdote",
  story: "Story",
};

export default function StoryCard({ story }: { story: Story }) {
  return (
    <div className="ds-card" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "var(--space-sm)",
        }}
      >
        <span className="ds-chip ds-chip-category">
          {CATEGORY_LABEL[story.category] ?? story.category}
        </span>
        {story.year && (
          <span className="text-micro" style={{ margin: 0 }}>
            {story.year}
          </span>
        )}
      </div>
      <p className="text-title" style={{ margin: "0 0 var(--space-sm) 0", color: "var(--fg)" }}>
        {story.title}
      </p>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          lineHeight: 1.5,
          color: "var(--muted)",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {story.summary}
      </p>
      <span
        className="text-micro"
        style={{ marginTop: "auto", paddingTop: "var(--space-md)", color: "var(--floodlight-cyan)" }}
      >
        Read story →
      </span>
    </div>
  );
}
