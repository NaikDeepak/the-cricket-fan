"use client";
import { useState, useEffect, useRef } from "react";
import { api, type PlayerResult } from "@/lib/api";

type Props = {
  label: string;
  value: string;
  onSelect: (name: string) => void;
};

const inputStyle: React.CSSProperties = {
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
};

export default function PlayerPicker({ label, value, onSelect }: Props) {
  const [input, setInput] = useState(value);
  const [results, setResults] = useState<PlayerResult[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setInput(value); }, [value]);

  useEffect(() => {
    if (input.length < 2) { setResults([]); setOpen(false); return; }
    const timer = setTimeout(async () => {
      try {
        const data = await api.players(input);
        setResults(data);
        setOpen(data.length > 0);
      } catch {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [input]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (name: string) => {
    setInput(name);
    setResults([]);
    setOpen(false);
    onSelect(name);
  };

  return (
    <div ref={containerRef} style={{ position: "relative", flex: 1, minWidth: 0 }}>
      <div
        style={{
          fontSize: "9px",
          letterSpacing: "0.12em",
          color: "var(--muted)",
          textTransform: "uppercase",
          marginBottom: "6px",
        }}
      >
        {label}
      </div>
      <input
        value={input}
        onChange={(e) => { setInput(e.target.value); onSelect(e.target.value); }}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Start typing..."
        style={inputStyle}
      />
      {open && results.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "#111",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            zIndex: 20,
            overflow: "hidden",
          }}
        >
          {results.map((p) => (
            <button
              key={p.id}
              onClick={() => select(p.name)}
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 14px",
                background: "none",
                border: "none",
                borderBottom: "1px solid var(--border)",
                color: "var(--fg)",
                cursor: "pointer",
                fontFamily: "Space Grotesk, sans-serif",
                fontSize: "14px",
                textAlign: "left",
              }}
            >
              <span>{p.name}</span>
              <span style={{ fontSize: "10px", color: "var(--muted)", letterSpacing: "0.1em" }}>
                {p.team}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
