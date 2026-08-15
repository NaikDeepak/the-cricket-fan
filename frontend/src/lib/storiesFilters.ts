export type VaultFilters = { q: string; tag: string | null; source?: string | null };

export function filtersFromSearchParams(sp: URLSearchParams): VaultFilters {
  const res: VaultFilters = {
    q: sp.get("q") ?? "",
    tag: sp.get("tag"),
  };
  const src = sp.get("source");
  if (src !== null) {
    res.source = src;
  }
  return res;
}

export function queryStringFromFilters(f: VaultFilters): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.tag) p.set("tag", f.tag);
  if (f.source) p.set("source", f.source);
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Full /stories URL (path + query string) for a given filter state. */
export function storiesUrl(f: VaultFilters): string {
  return "/stories" + queryStringFromFilters(f);
}

export function nextFiltersOnTagSelect(
  qInput: string,
  activeTag: string | null,
  tag: string | null,
  activeSource?: string | null
): VaultFilters {
  const res: VaultFilters = {
    q: qInput,
    tag: tag === activeTag ? null : tag,
  };
  if (activeSource) {
    res.source = activeSource;
  }
  return res;
}

export function nextFiltersOnSourceSelect(
  qInput: string,
  activeSource: string | null,
  source: string | null,
  activeTag?: string | null
): VaultFilters {
  const res: VaultFilters = {
    q: qInput,
    tag: activeTag || null,
  };
  if (source && source !== activeSource) {
    res.source = source;
  }
  return res;
}

/**
 * Decide whether the local `qInput` debounce buffer should resync from the
 * URL's `q` (source of truth). `lastPushedQ` is the last `q` value this
 * component itself pushed into the URL (via the debounce commit or a tag
 * click that carried qInput). If the URL's `q` matches it, the change is
 * just our own push echoing back through `useSearchParams` — leave the
 * buffer alone (returns null). If it doesn't match, something else changed
 * the URL (browser back/forward) and the buffer must resync to it.
 */
export function resolveQSync(
  urlQ: string,
  lastPushedQ: string
): { qInput: string; lastPushedQ: string } | null {
  if (urlQ === lastPushedQ) return null;
  return { qInput: urlQ, lastPushedQ: urlQ };
}
