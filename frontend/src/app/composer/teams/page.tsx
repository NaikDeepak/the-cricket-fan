"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  composerApi,
  type TeamRecord,
  type TeamIn,
  type TeamPatch,
} from "@/lib/composerApi";

// ── helpers ────────────────────────────────────────────────────────────────

function isLight(hex: string): boolean {
  const clean = hex.replace("#", "").padEnd(6, "0");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.65;
}

function hexGlow(hex: string): string {
  const clean = hex.replace("#", "").padEnd(6, "0");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0.4)`;
}

function Swatch({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "var(--radius-xs)",
        background: color,
        border: "1px solid rgba(0,0,0,0.12)",
        flexShrink: 0,
      }}
    />
  );
}

function LeagueBadge({ league }: { league: string }) {
  return (
    <span
      className="ds-badge"
      style={{
        background: "rgba(0,0,0,0.06)",
        color: "var(--fg)",
      }}
    >
      {league}
    </span>
  );
}

// ── Inline color edit form ─────────────────────────────────────────────────

interface EditState {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  gradient: string;
  glow: string;
  text_dark: boolean;
  logo_url: string;
  aliases: string;
  is_active: boolean;
}

function TeamEditDrawer({
  team,
  onSave,
  onCancel,
}: {
  team: TeamRecord;
  onSave: (patch: TeamPatch) => Promise<void>;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<EditState>({
    primary_color: team.primary_color,
    secondary_color: team.secondary_color,
    accent_color: team.accent_color ?? team.primary_color,
    gradient:
      team.gradient ??
      `linear-gradient(135deg, ${team.primary_color} 0%, ${team.secondary_color} 100%)`,
    glow: team.glow ?? hexGlow(team.primary_color),
    text_dark: team.text_dark,
    logo_url: team.logo_url ?? "",
    aliases: team.aliases.join(", "),
    is_active: team.is_active,
  });

  function set<K extends keyof EditState>(k: K, v: EditState[K]) {
    setForm((p) => {
      const next = { ...p, [k]: v };
      if (k === "primary_color" || k === "secondary_color") {
        next.gradient = `linear-gradient(135deg, ${next.primary_color} 0%, ${next.secondary_color} 100%)`;
        next.text_dark = isLight(next.primary_color);
      }
      if (k === "primary_color") {
        next.glow = hexGlow(v as string);
        next.accent_color = v as string;
      }
      return next;
    });
  }

  const preview = {
    background: form.gradient,
    color: form.text_dark ? "#000" : "#fff",
  };

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({
        primary_color: form.primary_color,
        secondary_color: form.secondary_color,
        accent_color: form.accent_color || undefined,
        gradient: form.gradient || undefined,
        glow: form.glow || undefined,
        text_dark: form.text_dark,
        logo_url: form.logo_url || undefined,
        aliases: form.aliases.split(",").map((s) => s.trim()).filter(Boolean),
        is_active: form.is_active,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="ds-card"
      style={{
        padding: "16px 18px",
        background: "#fafafa",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            ...preview,
            borderRadius: "var(--radius-sm)",
            padding: "6px 14px",
            fontWeight: 800,
            fontSize: 13,
            letterSpacing: 0.5,
            transition: "all 0.25s ease",
          }}
        >
          {team.short_name} · {team.name}
        </div>
        <div style={{ fontSize: 11, color: "var(--fg-muted)" }}>
          Live preview
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {(
          [
            { key: "primary_color" as const, label: "Primary" },
            { key: "secondary_color" as const, label: "Secondary" },
            { key: "accent_color" as const, label: "Accent" },
          ]
        ).map(({ key, label }) => (
          <label key={key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="text-micro" style={{ margin: 0 }}>
              {label}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="color"
                value={form[key]}
                onChange={(e) => set(key, e.target.value)}
                style={{ width: 28, height: 24, padding: 0, border: "none", cursor: "pointer", borderRadius: 4 }}
              />
              <input
                className="ds-input"
                value={form[key]}
                onChange={(e) => set(key, e.target.value)}
                style={{ flex: 1, fontSize: 11, fontFamily: "monospace", padding: "4px 6px" }}
              />
            </div>
          </label>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="text-micro" style={{ margin: 0 }}>Gradient CSS</span>
          <input
            className="ds-input"
            value={form.gradient}
            onChange={(e) => set("gradient", e.target.value)}
            style={{ fontSize: 11, fontFamily: "monospace", padding: "4px 6px" }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="text-micro" style={{ margin: 0 }}>Glow</span>
          <input
            className="ds-input"
            value={form.glow}
            onChange={(e) => set("glow", e.target.value)}
            style={{ fontSize: 11, fontFamily: "monospace", padding: "4px 6px" }}
          />
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="text-micro" style={{ margin: 0 }}>Logo URL</span>
          <input
            className="ds-input"
            value={form.logo_url}
            onChange={(e) => set("logo_url", e.target.value)}
            placeholder="https://…"
            style={{ fontSize: 11, padding: "4px 6px" }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="text-micro" style={{ margin: 0 }}>Aliases</span>
          <input
            className="ds-input"
            value={form.aliases}
            onChange={(e) => set("aliases", e.target.value)}
            placeholder="CSK, Super Kings"
            style={{ fontSize: 11, padding: "4px 6px" }}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
          <input type="checkbox" checked={form.text_dark} onChange={(e) => set("text_dark", e.target.checked)} />
          Dark text on badge
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
          <input type="checkbox" checked={form.is_active} onChange={(e) => set("is_active", e.target.checked)} />
          Active team
        </label>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" onClick={onCancel} className="ds-btn ds-btn-secondary" style={{ fontSize: 12, padding: "4px 10px" }}>
          Cancel
        </button>
        <button type="button" onClick={handleSave} disabled={saving} className="ds-btn ds-btn-primary" style={{ fontSize: 12, padding: "4px 12px" }}>
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

// ── Add Team Modal ─────────────────────────────────────────────────────────

const ALL_LEAGUES = ["IPL", "WPL", "TNPL", "MPL", "CPL", "BBL", "SA20", "PSL", "MLC", "International"];

function AddTeamModal({ onSave, onCancel }: { onSave: (body: TeamIn) => Promise<void>; onCancel: () => void }) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [league, setLeague] = useState("IPL");
  const [primary, setPrimary] = useState("#004BA0");
  const [secondary, setSecondary] = useState("#0088FF");
  const [accent, setAccent] = useState("#0088FF");
  const [logoUrl, setLogoUrl] = useState("");
  const [aliasStr, setAliasStr] = useState("");
  const [textDark, setTextDark] = useState(false);
  const [isActive, setIsActive] = useState(true);

  function updatePrimary(v: string) {
    setPrimary(v);
    setAccent(v);
    setTextDark(isLight(v));
  }

  const previewGrad = `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        short_name: shortName.trim(),
        league,
        primary_color: primary,
        secondary_color: secondary,
        accent_color: accent,
        gradient: previewGrad,
        glow: hexGlow(primary),
        text_dark: textDark,
        logo_url: logoUrl || undefined,
        aliases: aliasStr ? aliasStr.split(",").map((s) => s.trim()).filter(Boolean) : [],
        is_active: isActive,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(4px)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
        padding: "var(--space-lg)",
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="ds-card"
        style={{
          background: "#ffffff",
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-lg)",
          width: "100%",
          maxWidth: 540,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--fg)" }}>Add New Team</h2>
          <div
            style={{
              padding: "4px 12px",
              borderRadius: "var(--radius-xs)",
              fontWeight: 700,
              fontSize: 12,
              background: previewGrad,
              color: textDark ? "#000" : "#fff",
              transition: "all 0.2s ease",
            }}
          >
            {shortName || "???"}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
          <label className="text-micro">
            Team Name *
            <input className="ds-input" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Chennai Super Kings" style={{ marginTop: 4 }} />
          </label>
          <label className="text-micro">
            Short Code *
            <input className="ds-input" value={shortName} onChange={(e) => setShortName(e.target.value)} required maxLength={8} placeholder="CSK" style={{ marginTop: 4 }} />
          </label>
        </div>

        <label className="text-micro">
          League *
          <select className="ds-select" value={league} onChange={(e) => setLeague(e.target.value)} required style={{ marginTop: 4 }}>
            {ALL_LEAGUES.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {([
            { label: "Primary *", val: primary, set: updatePrimary },
            { label: "Secondary *", val: secondary, set: setSecondary },
            { label: "Accent *", val: accent, set: setAccent },
          ]).map(({ label, val, set: setFn }) => (
            <label key={label} className="text-micro" style={{ gap: 4 }}>
              {label}
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                <input
                  type="color"
                  value={val}
                  onChange={(e) => setFn(e.target.value)}
                  style={{ width: 28, height: 24, padding: 0, border: "none", borderRadius: 3, cursor: "pointer" }}
                />
                <input
                  className="ds-input"
                  value={val}
                  onChange={(e) => setFn(e.target.value)}
                  style={{ flex: 1, fontSize: 10, fontFamily: "monospace", padding: "3px 5px" }}
                />
              </div>
            </label>
          ))}
        </div>

        <label className="text-micro">
          Aliases (comma-separated)
          <input className="ds-input" value={aliasStr} onChange={(e) => setAliasStr(e.target.value)} placeholder="Super Kings, Yellow Army" style={{ marginTop: 4 }} />
        </label>

        <label className="text-micro">
          Logo URL (optional)
          <input className="ds-input" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" style={{ marginTop: 4 }} />
        </label>

        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            <input type="checkbox" checked={textDark} onChange={(e) => setTextDark(e.target.checked)} />
            Dark text on badge
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active
          </label>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          <button type="button" onClick={onCancel} className="ds-btn ds-btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="ds-btn ds-btn-primary">{saving ? "Adding…" : "Add Team"}</button>
        </div>
      </form>
    </div>
  );
}

// ── Team Card ──────────────────────────────────────────────────────────────

function TeamCard({ team, onEdit, onDelete }: { team: TeamRecord; onEdit: () => void; onDelete: () => void }) {
  const grad = team.gradient ?? `linear-gradient(135deg, ${team.primary_color} 0%, ${team.secondary_color} 100%)`;
  const txtColor = team.text_dark ? "#000" : "#fff";

  return (
    <div
      className="ds-card"
      style={{
        background: "#ffffff",
        padding: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        opacity: team.is_active ? 1 : 0.6,
      }}
    >
      <div
        style={{
          background: grad,
          padding: "14px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: txtColor, letterSpacing: "-0.02em", lineHeight: 1 }}>
            {team.short_name}
          </div>
          <div style={{ fontSize: 11, color: txtColor, opacity: 0.85, marginTop: 3, fontWeight: 600 }}>
            {team.name}
          </div>
        </div>
        <LeagueBadge league={team.league} />
      </div>

      <div style={{ padding: "10px 14px", display: "flex", gap: 6, alignItems: "center", borderBottom: "1px solid var(--border)" }}>
        <Swatch color={team.primary_color} size={16} />
        <Swatch color={team.secondary_color} size={16} />
        {team.accent_color && <Swatch color={team.accent_color} size={16} />}
        <span style={{ fontSize: 11, color: "var(--fg-muted)", marginLeft: 4, fontFamily: "monospace" }}>
          {team.primary_color}
        </span>
        {!team.is_active && (
          <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, color: "var(--fg-muted)" }}>INACTIVE</span>
        )}
      </div>

      {team.aliases.length > 0 && (
        <div style={{ padding: "6px 14px", display: "flex", gap: 4, flexWrap: "wrap" }}>
          {team.aliases.map((a) => (
            <span key={a} className="ds-badge" style={{ background: "var(--surface-tertiary)", color: "var(--fg-muted)", fontSize: 10 }}>
              {a}
            </span>
          ))}
        </div>
      )}

      <div style={{ padding: "8px 14px", marginTop: "auto", display: "flex", justifyContent: "flex-end", gap: 6 }}>
        <button type="button" onClick={onEdit} className="ds-btn ds-btn-secondary" style={{ fontSize: 11, padding: "3px 8px" }}>
          Edit Colors
        </button>
        <button type="button" onClick={onDelete} className="ds-btn ds-btn-ghost" style={{ fontSize: 11, padding: "3px 6px" }}>
          Delete
        </button>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function TeamsPage() {
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [leagueFilter, setLeagueFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const loadTeams = useCallback(async () => {
    setLoading(true);
    try {
      const data = await composerApi.teams();
      setTeams(data);
      setError(null);
    } catch {
      setError("Cannot reach composer backend. Make sure it is running on port 8000.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTeams();
  }, [loadTeams]);

  const leagues = useMemo(() => {
    const s = new Set(teams.map((t) => t.league));
    return ["All", ...Array.from(s).sort()];
  }, [teams]);

  const filtered = useMemo(() => {
    return teams.filter((t) => {
      if (leagueFilter !== "All" && t.league !== leagueFilter) return false;
      if (!showInactive && !t.is_active) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          t.name.toLowerCase().includes(q) ||
          t.short_name.toLowerCase().includes(q) ||
          t.league.toLowerCase().includes(q) ||
          t.aliases.some((a) => a.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [teams, leagueFilter, showInactive, search]);

  async function handlePatch(id: number, patch: TeamPatch) {
    await composerApi.patchTeam(id, patch);
    setEditingId(null);
    await loadTeams();
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this team from the database?")) return;
    await composerApi.deleteTeam(id);
    await loadTeams();
  }

  async function handleAdd(body: TeamIn) {
    await composerApi.createTeam(body);
    setShowAddModal(false);
    await loadTeams();
  }

  const byLeague = useMemo(() => {
    const map: Record<string, TeamRecord[]> = {};
    for (const t of filtered) {
      if (!map[t.league]) map[t.league] = [];
      map[t.league].push(t);
    }
    return map;
  }, [filtered]);

  const LEAGUE_ORDER = ["IPL", "TNPL", "WPL", "MPL", "CPL", "BBL", "SA20", "PSL", "MLC", "International"];
  const orderedLeagues = [
    ...LEAGUE_ORDER.filter((l) => byLeague[l]),
    ...Object.keys(byLeague).filter((l) => !LEAGUE_ORDER.includes(l)),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: "var(--space-xs)" }}>
            <span className="ds-badge" style={{ background: "var(--surface-tertiary)", color: "var(--fg-secondary)" }}>
              Team Database
            </span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", margin: "var(--space-xs) 0", color: "var(--fg)" }}>
            Teams &amp; Color Palettes
          </h1>
          <p className="text-caption" style={{ maxWidth: 640, margin: 0 }}>
            Manage official team color themes in the database. These palettes theme prediction cards, match graphics, and badges.
          </p>
        </div>
        <button type="button" onClick={() => setShowAddModal(true)} className="ds-btn ds-btn-primary">
          + Add Team
        </button>
      </div>

      {/* Stats Bar */}
      {!loading && !error && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
          {[
            { label: "Total Teams", value: teams.length },
            { label: "Active Teams", value: teams.filter((t) => t.is_active).length },
            { label: "Leagues", value: new Set(teams.map((t) => t.league)).size },
            { label: "Shown", value: filtered.length },
          ].map(({ label, value }) => (
            <div key={label} className="ds-card" style={{ padding: "12px 16px", background: "#ffffff" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "var(--fg)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
              <div className="text-micro" style={{ marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter Bar */}
      <div className="ds-card" style={{ background: "#ffffff", padding: "12px 16px", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {leagues.map((lg) => (
            <button
              key={lg}
              type="button"
              onClick={() => setLeagueFilter(lg)}
              className={`ds-filter-tab ${leagueFilter === lg ? "ds-filter-tab--active" : ""}`}
              style={{ fontSize: 11, padding: "3px 8px" }}
            >
              {lg}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500, cursor: "pointer", color: "var(--fg-secondary)" }}>
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Show inactive
          </label>
          <input
            className="ds-input"
            placeholder="Search teams…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ fontSize: 12, padding: "5px 10px", width: 160 }}
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="ds-card" style={{ padding: "var(--space-md)", textAlign: "center", color: "var(--fg-muted)", fontSize: 13 }}>
          Loading team database…
        </div>
      ) : error ? (
        <div
          className="ds-card"
          style={{
            padding: "10px 14px",
            background: "var(--error-tint)",
            borderColor: "rgba(239, 68, 68, 0.2)",
            color: "var(--error-text)",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="ds-card" style={{ padding: "var(--space-xl)", textAlign: "center", background: "#ffffff" }}>
          <p style={{ margin: 0, color: "var(--fg-muted)", fontSize: 13 }}>No teams match your filter.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xl)" }}>
          {orderedLeagues.map((league) => (
            <section key={league}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span className="text-micro" style={{ color: "var(--fg)", fontSize: 12 }}>
                  {league}
                </span>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                <span style={{ fontSize: 11, color: "var(--fg-muted)", fontVariantNumeric: "tabular-nums" }}>
                  {byLeague[league].length} {byLeague[league].length === 1 ? "team" : "teams"}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "var(--space-md)" }}>
                {byLeague[league].map((team) => (
                  <div key={team.id}>
                    {editingId === team.id ? (
                      <TeamEditDrawer
                        team={team}
                        onSave={(patch) => handlePatch(team.id, patch)}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <TeamCard
                        team={team}
                        onEdit={() => setEditingId(team.id)}
                        onDelete={() => handleDelete(team.id)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {showAddModal && <AddTeamModal onSave={handleAdd} onCancel={() => setShowAddModal(false)} />}
    </div>
  );
}
