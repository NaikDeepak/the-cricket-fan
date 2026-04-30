import { Suspense } from "react";
import StatExplorer from "@/components/explorer/StatExplorer";

export default function ExplorePage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            color: "var(--muted)",
            fontSize: "13px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          Loading...
        </div>
      }
    >
      <StatExplorer />
    </Suspense>
  );
}
