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

/** Full /stories URL (path + query string) for a given filter state. */
export function storiesUrl(f: VaultFilters): string {
  return "/stories" + queryStringFromFilters(f);
}

/**
 * Next filter state when a tag pill is clicked. Carries the live (possibly
 * not-yet-committed) `qInput` text rather than the committed `filters.q`, so
 * a tag click mid-debounce doesn't discard just-typed search text. Clicking
 * the already-active tag clears it (toggle behavior).
 */
export function nextFiltersOnTagSelect(
  qInput: string,
  activeTag: string | null,
  tag: string | null
): VaultFilters {
  return { q: qInput, tag: tag === activeTag ? null : tag };
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
