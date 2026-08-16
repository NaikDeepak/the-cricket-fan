"use client";

import type { Story } from "@/lib/storiesApi";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function OnThisDayCardImg({
  story,
  dayStr,
  monthStr,
  isBirthday,
}: {
  story: Story;
  dayStr?: string;
  monthStr?: string;
  isBirthday?: boolean;
}) {
  const isBday = isBirthday ?? (story.tags?.includes("birthday") || false);
  const currentYear = new Date().getFullYear();
  const yearsAgo = story.year ? currentYear - story.year : null;
  const monthIndex = Number(story.event_month_day?.split("-")[0]) - 1;
  const monthName = MONTHS[monthIndex] || monthStr;
  const dayNum = Number(dayStr || story.event_month_day?.split("-")[1]) || "";

  return (
    <div
      style={{
        width: 1080,
        height: 1080,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        background: "linear-gradient(165deg, #09090b 0%, #18181b 100%)",
        color: "#ffffff",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', Inter, sans-serif",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* Top Header */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 36,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span
              style={{
                width: 44,
                height: 44,
                borderRadius: 8,
                background: "#ffffff",
                color: "#000000",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                fontSize: 16,
                letterSpacing: "0.04em",
              }}
            >
              TCF
            </span>
            <div>
              <span
                style={{
                  fontSize: 18,
                  letterSpacing: 3,
                  fontWeight: 700,
                  color: "#ffffff",
                  textTransform: "uppercase",
                }}
              >
                On This Day in Cricket
              </span>
              <div style={{ fontSize: 14, color: "rgba(255, 255, 255, 0.6)", marginTop: 2 }}>
                Archive &amp; Milestones
              </div>
            </div>
          </div>

          <div
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.16)",
              padding: "8px 20px",
              borderRadius: 8,
              fontSize: 20,
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: 1,
            }}
          >
            {dayNum} {monthName}
          </div>
        </div>

        {/* Anniversary Stamp Badge */}
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 28 }}>
          {yearsAgo !== null && yearsAgo > 0 && (
            <span
              style={{
                background: isBday ? "rgba(236, 72, 153, 0.2)" : "rgba(255, 255, 255, 0.1)",
                color: isBday ? "#f472b6" : "#ffffff",
                border: `1px solid ${isBday ? "rgba(236, 72, 153, 0.4)" : "rgba(255, 255, 255, 0.16)"}`,
                padding: "6px 16px",
                borderRadius: 6,
                fontSize: 16,
                fontWeight: 600,
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              {isBday ? `${yearsAgo}th Birthday Tribute` : `${yearsAgo} Years Ago Today (${story.year})`}
            </span>
          )}
          {story.match_format && (
            <span
              style={{
                background: "rgba(255, 255, 255, 0.06)",
                color: "rgba(255, 255, 255, 0.8)",
                padding: "6px 14px",
                borderRadius: 6,
                fontSize: 15,
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
            fontSize: 56,
            fontWeight: 700,
            lineHeight: 1.18,
            marginBottom: 28,
            color: "#ffffff",
            letterSpacing: "-0.02em",
          }}
        >
          {story.title}
        </h1>

        <div
          style={{
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: 16,
            padding: 32,
          }}
        >
          <p
            style={{
              fontSize: 26,
              lineHeight: 1.55,
              color: "rgba(255, 255, 255, 0.9)",
              margin: 0,
              display: "-webkit-box",
              WebkitLineClamp: 5,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {story.summary || story.segments?.[0]}
          </p>
        </div>
      </div>

      {/* Footer Branding Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "1px solid rgba(255, 255, 255, 0.12)",
          paddingTop: 28,
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: "rgba(255, 255, 255, 0.9)",
            }}
          >
            The Cricket Fan Archive
          </span>
          <span style={{ color: "rgba(255, 255, 255, 0.4)", fontSize: 16 }}>•</span>
          <span style={{ fontSize: 16, color: "rgba(255, 255, 255, 0.6)" }}>
            thecricketfan.club
          </span>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          {(story.tags || []).slice(0, 3).map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 15,
                color: "rgba(255, 255, 255, 0.6)",
                background: "rgba(255, 255, 255, 0.06)",
                padding: "4px 12px",
                borderRadius: 4,
                fontWeight: 500,
              }}
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
