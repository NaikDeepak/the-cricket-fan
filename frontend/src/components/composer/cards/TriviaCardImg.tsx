import type { Draft } from "@/lib/composerApi";

export default function TriviaCardImg({
  draft,
  aspect = "1:1",
}: {
  draft: Draft;
  aspect?: "1:1" | "16:9" | "4:5";
}) {
  const meta = draft.card_meta ?? {};
  const question = (meta.question as string) || draft.text;
  const options = (meta.options as string[]) || [];

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
        background: "linear-gradient(135deg, #09090b 0%, #1e1b4b 100%)",
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
          borderBottom: "2px solid #312e81",
          paddingBottom: 24,
        }}
      >
        <span
          style={{
            fontSize: 24,
            letterSpacing: 2,
            color: "#a5b4fc",
            fontWeight: 600,
          }}
        >
          ❓ CRICKET TRIVIA
        </span>
        <span
          style={{
            fontSize: 20,
            background: "#312e81",
            padding: "6px 16px",
            borderRadius: 20,
            color: "#c7d2fe",
          }}
        >
          DAILY QUIZ
        </span>
      </div>

      <div style={{ margin: "24px 0" }}>
        <p
          style={{
            fontSize: 32,
            fontWeight: 600,
            lineHeight: 1.4,
            color: "#f8fafc",
            marginBottom: 32,
          }}
        >
          {question}
        </p>

        {options.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
            }}
          >
            {options.map((opt, i) => (
              <div
                key={i}
                style={{
                  background: "rgba(49, 46, 129, 0.4)",
                  border: "1px solid #4338ca",
                  padding: "16px 20px",
                  borderRadius: 12,
                  fontSize: 24,
                  color: "#e0e7ff",
                }}
              >
                <span style={{ color: "#818cf8", marginRight: 12 }}>
                  {String.fromCharCode(65 + i)}.
                </span>
                {opt}
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "2px solid #312e81",
          paddingTop: 24,
          fontSize: 20,
          color: "#818cf8",
        }}
      >
        <span>THE CRICKET FAN</span>
        <span>#CricketTrivia</span>
      </div>
    </div>
  );
}
