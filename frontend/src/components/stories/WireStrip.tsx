import type { WireItem } from "@/lib/storiesApi";
import { formatDateStamp } from "@/lib/storiesApi";

export default function WireStrip({ items }: { items: WireItem[] }) {
  if (items.length === 0) return null;
  return (
    <section data-rail="the-wire" style={{ marginBottom: "var(--space-xl)" }}>
      <p className="text-micro" style={{ color: "var(--floodlight-cyan)", margin: "0 0 var(--space-sm) 0" }}>
        The Wire — recently posted
      </p>
      <div style={{ display: "flex", gap: "var(--space-md)", overflowX: "auto", paddingBottom: "var(--space-sm)" }}>
        {items.map((item) => (
          <div
            key={item.id}
            className="ds-card"
            style={{
              minWidth: 320,
              flex: "0 0 auto",
              borderLeft: "3px solid var(--floodlight-cyan)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-sm)" }}>
              {item.category && <span className="ds-chip ds-chip-category">{item.category}</span>}
              <span className="text-micro" style={{ margin: 0 }}>
                {formatDateStamp(item.posted_at)}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--fg)" }}>
              {item.text.slice(0, 120)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
