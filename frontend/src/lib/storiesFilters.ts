export type VaultFilters = { q: string; tag: string | null };

export function filtersFromSearchParams(sp: URLSearchParams): VaultFilters {
  return { q: sp.get("q") ?? "", tag: sp.get("tag") };
}

export function queryStringFromFilters(f: VaultFilters): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.tag) p.set("tag", f.tag);
  const s = p.toString();
  return s ? `?${s}` : "";
}
