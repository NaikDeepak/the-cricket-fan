export default function StoryBeats({ segments }: { segments: string[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
      {segments.map((seg, i) => (
        <div
          key={i}
          data-beat
          className="ds-quote"
          style={{ position: "relative" }}
        >
          {segments.length > 1 && (
            <span
              className="text-micro"
              style={{ position: "absolute", top: 0, right: 0, margin: 0 }}
            >
              {i + 1}/{segments.length}
            </span>
          )}
          <p>{seg}</p>
        </div>
      ))}
    </div>
  );
}
