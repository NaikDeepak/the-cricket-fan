import type { Story } from "@/lib/storiesApi";

const MONTH_NAMES = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
];

export default function OnThisDayCardImg({ story }: { story: Story }) {
  const md = story.event_month_day || "08-15";
  const [mStr, dStr] = md.split("-");
  const monthName = MONTH_NAMES[parseInt(mStr, 10) - 1] || "AUGUST";
  const dayNum = parseInt(dStr, 10) || 15;

  const currentYear = new Date().getFullYear();
  const yearsAgo = story.year ? currentYear - story.year : null;
  const isBirthday = (story.tags || []).includes("birthday") || story.title.toLowerCase().includes("birthday");

  const keyLine = story.segments[0] || story.summary || "";

  return (
    <div
      style={{
        width: 1080,
        height: 1350,
        background: "radial-gradient(circle at 50% 20%, #291a04 0%, #0f0a02 60%, #050301 100%)",
        color: "#ffffff",
        padding: 68,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        boxSizing: "border-box",
        fontFamily: "'Space Grotesk', sans-serif",
        position: "relative",
        overflow: "hidden",
        border: "4px solid rgba(245, 158, 11, 0.4)",
      }}
    >
      {/* Decorative Golden Glow Orbs */}
      <div
        style={{
          position: "absolute",
          top: -100,
          right: -100,
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(245, 158, 11, 0.25) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -150,
          left: -150,
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(217, 119, 6, 0.15) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Top Header Strip */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "2px solid rgba(245, 158, 11, 0.3)",
            paddingBottom: 24,
            marginBottom: 32,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 32 }}>🗓️</span>
            <div>
              <span
                style={{
                  fontSize: 20,
                  letterSpacing: 4,
                  fontWeight: 800,
                  color: "#f59e0b",
                  textTransform: "uppercase",
                }}
              >
                ON THIS DAY IN CRICKET
              </span>
              <div style={{ fontSize: 16, color: "rgba(255, 255, 255, 0.6)", marginTop: 2 }}>
                DAILY NOSTALGIA &amp; ICONIC MOMENTS
              </div>
            </div>
          </div>

          <div
            style={{
              background: "rgba(245, 158, 11, 0.18)",
              border: "1px solid rgba(245, 158, 11, 0.5)",
              padding: "8px 24px",
              borderRadius: 999,
              fontSize: 22,
              fontWeight: 800,
              color: "#fbbf24",
              letterSpacing: 2,
            }}
          >
            {dayNum} {monthName}
          </div>
        </div>

        {/* Anniversary Stamp Badge */}
        <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 28 }}>
          {yearsAgo !== null && yearsAgo > 0 && (
            <span
              style={{
                background: isBirthday ? "rgba(236, 72, 153, 0.2)" : "rgba(245, 158, 11, 0.25)",
                color: isBirthday ? "#f472b6" : "#fde047",
                border: `1px solid ${isBirthday ? "rgba(236, 72, 153, 0.5)" : "rgba(245, 158, 11, 0.6)"}`,
                padding: "8px 20px",
                borderRadius: 999,
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: 1.5,
                textTransform: "uppercase",
              }}
            >
              {isBirthday ? `🎂 ${yearsAgo}TH BIRTHDAY TRIBUTE` : `🏆 ${yearsAgo} YEARS AGO TODAY (${story.year})`}
            </span>
          )}
          {story.match_format && (
            <span
              style={{
                background: "rgba(255, 255, 255, 0.1)",
                color: "rgba(255, 255, 255, 0.8)",
                padding: "8px 18px",
                borderRadius: 999,
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              {story.match_format}
            </span>
          )}
        </div>
      </div>

      {/* Main Headline & Story Narrative Beat */}
      <div style={{ margin: "20px 0" }}>
        <h1
          style={{
            fontSize: 64,
            fontWeight: 800,
            lineHeight: 1.15,
            marginBottom: 32,
            color: "#ffffff",
            letterSpacing: "-0.02em",
            textShadow: "0 4px 20px rgba(0, 0, 0, 0.6)",
          }}
        >
          {story.title}
        </h1>

        <div
          style={{
            background: "rgba(0, 0, 0, 0.45)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(245, 158, 11, 0.2)",
            borderRadius: 24,
            padding: 36,
            borderLeft: "8px solid #f59e0b",
          }}
        >
          <p
            style={{
              fontSize: 30,
              lineHeight: 1.5,
              color: "rgba(255, 255, 255, 0.95)",
              margin: 0,
              fontStyle: "italic",
            }}
          >
            &ldquo;{keyLine}&rdquo;
          </p>
        </div>
      </div>

      {/* Footer Branding & Entities */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "2px solid rgba(245, 158, 11, 0.3)",
            paddingTop: 28,
            fontSize: 22,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontWeight: 800, color: "#ffffff", letterSpacing: 2 }}>
              THE CRICKET FAN
            </span>
            <span style={{ color: "rgba(255, 255, 255, 0.4)" }}>•</span>
            <span style={{ color: "#fbbf24", fontWeight: 600 }}>thecricketfan.com</span>
          </div>

          <div style={{ display: "flex", gap: 14, color: "#f59e0b", fontWeight: 700, fontSize: 20 }}>
            <span>#OnThisDay</span>
            <span>#TheCricketFan</span>
          </div>
        </div>
      </div>
    </div>
  );
}
