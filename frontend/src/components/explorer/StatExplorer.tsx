"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PlayerPicker from "./PlayerPicker";
import StatResult from "./StatResult";
import ExplorerShareCard from "./ExplorerShareCard";
import { api, type BattleData, type VenueTeamData } from "@/lib/api";

type Tab = "pvp" | "venue";

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "pvp"; data: BattleData }
  | { status: "venue"; data: VenueTeamData }
  | { status: "error"; message: string };

export default function StatExplorer() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<Tab>((searchParams.get("mode") as Tab) ?? "pvp");
  const [p1, setP1] = useState(searchParams.get("p1") ?? "");    // batsman
  const [p2, setP2] = useState(searchParams.get("p2") ?? "");    // bowler
  const [venue, setVenue] = useState(searchParams.get("venue") ?? "");
  const [team, setTeam] = useState(searchParams.get("team") ?? "");
  const [fetchState, setFetchState] = useState<FetchState>({ status: "idle" });

  // Auto-fetch on mount when params are pre-filled (quicklink navigation)
  useEffect(() => {
    if (tab === "pvp" && p1 && p2) fetchPvP(p1, p2);
    else if (tab === "venue" && venue && team) fetchVenue(venue, team);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pushUrl = (params: Record<string, string>) => {
    router.replace(`/explore?${new URLSearchParams(params).toString()}`, { scroll: false });
  };

  const switchTab = (t: Tab) => {
    setTab(t);
    setFetchState({ status: "idle" });
    pushUrl({ mode: t });
  };

  const fetchPvP = async (batsman: string, bowler: string) => {
    setFetchState({ status: "loading" });
    try {
      const data = await api.battle(batsman, bowler);
      setFetchState({ status: "pvp", data });
    } catch {
      setFetchState({ status: "error", message: "No head-to-head data for this matchup yet." });
    }
  };

  const fetchVenue = async (v: string, t: string) => {
    setFetchState({ status: "loading" });
    try {
      const data = await api.venueTeam(v, t);
      setFetchState({ status: "venue", data });
    } catch {
      setFetchState({ status: "error", message: "No venue data for this team yet." });
    }
  };

  const handleGo = () => {
    if (tab === "pvp") {
      pushUrl({ mode: "pvp", p1, p2 });
      fetchPvP(p1, p2);
    } else {
      pushUrl({ mode: "venue", venue, team });
      fetchVenue(venue, team);
    }
  };

  const canGo = tab === "pvp" ? p1.length > 0 && p2.length > 0 : venue.length > 0 && team.length > 0;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "24px" }}>
      <div style={{ maxWidth: "480px", margin: "0 auto" }}>
        <h1
          style={{
            fontSize: "24px",
            fontWeight: 900,
            letterSpacing: "-0.02em",
            marginBottom: "4px",
          }}
        >
          Stat Explorer
        </h1>
        <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "24px" }}>
          Find the stat your group chat hasn&apos;t seen yet
        </p>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
          {(["pvp", "venue"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              style={{
                padding: "6px 16px",
                borderRadius: "20px",
                border: `1px solid ${tab === t ? "var(--team-a)" : "var(--border)"}`,
                background: tab === t ? "rgba(0,75,160,0.15)" : "transparent",
                color: tab === t ? "var(--fg)" : "var(--muted)",
                fontSize: "12px",
                cursor: "pointer",
                fontFamily: "Space Grotesk, sans-serif",
              }}
            >
              {t === "pvp" ? "Player vs Player" : "Venue"}
            </button>
          ))}
        </div>

        {/* Inputs */}
        {tab === "pvp" ? (
          <div
            style={{
              display: "flex",
              gap: "12px",
              marginBottom: "20px",
              alignItems: "flex-end",
            }}
          >
            <PlayerPicker label="Batsman" value={p1} onSelect={setP1} />
            <span
              style={{
                fontSize: "12px",
                color: "var(--muted)",
                paddingBottom: "12px",
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              VS
            </span>
            <PlayerPicker label="Bowler" value={p2} onSelect={setP2} />
          </div>
        ) : (
          <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
            <div style={{ flex: 2 }}>
              <div
                style={{
                  fontSize: "9px",
                  letterSpacing: "0.12em",
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  marginBottom: "6px",
                }}
              >
                VENUE
              </div>
              <input
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="e.g. Wankhede Stadium, Mumbai"
                style={{
                  width: "100%",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  color: "var(--fg)",
                  fontSize: "14px",
                  fontFamily: "Space Grotesk, sans-serif",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: "9px",
                  letterSpacing: "0.12em",
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  marginBottom: "6px",
                }}
              >
                TEAM
              </div>
              <input
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                placeholder="e.g. MI"
                style={{
                  width: "100%",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  color: "var(--fg)",
                  fontSize: "14px",
                  fontFamily: "Space Grotesk, sans-serif",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>
        )}

        <button
          onClick={handleGo}
          disabled={!canGo || fetchState.status === "loading"}
          style={{
            width: "100%",
            padding: "14px",
            background: canGo ? "var(--team-a)" : "var(--border)",
            border: "none",
            borderRadius: "8px",
            color: canGo ? "#fff" : "var(--muted)",
            fontFamily: "Space Grotesk, sans-serif",
            fontSize: "13px",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            cursor: canGo && fetchState.status !== "loading" ? "pointer" : "not-allowed",
            marginBottom: "24px",
          }}
        >
          {fetchState.status === "loading" ? "FINDING STAT..." : "GO →"}
        </button>

        {fetchState.status === "error" && (
          <p
            style={{
              color: "var(--muted)",
              fontSize: "14px",
              textAlign: "center",
              padding: "24px 0",
            }}
          >
            {fetchState.message}
          </p>
        )}

        {fetchState.status === "pvp" && (
          <>
            <StatResult mode="pvp" data={fetchState.data} />
            <ExplorerShareCard mode="pvp" data={fetchState.data} />
          </>
        )}

        {fetchState.status === "venue" && (
          <>
            <StatResult mode="venue" data={fetchState.data} />
            <ExplorerShareCard mode="venue" data={fetchState.data} />
          </>
        )}
      </div>
    </div>
  );
}
