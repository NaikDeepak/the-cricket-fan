export default function StoryBeats({ segments }: { segments: string[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
      {segments.map((seg, i) => (
        <div
          key={i}
          data-beat
          className="card-container"
          style={{ padding: "var(--space-lg)", position: "relative" }}
        >
          {segments.length > 1 && (
            <span
              className="text-micro"
              style={{ position: "absolute", top: "var(--space-sm)", right: "var(--space-sm)", margin: 0 }}
            >
              {i + 1}/{segments.length}
            </span>
          )}
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.65, color: "var(--fg)" }}>{seg}</p>
        </div>
      ))}
    </div>
  );
}
