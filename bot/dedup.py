"""Intelligent deduplication engine for multi-source cricket stories and anecdotes.

Prevents duplicate or near-duplicate stories across Wikipedia, Reddit, Quora,
and Cricsheet through canonical entity normalization, fuzzy text similarity,
and entity overlap detection.
"""

import difflib
import re
from typing import Any


def slugify(text: str) -> str:
    """Convert text to lowercase alphanumeric hyphen-separated slug."""
    text = re.sub(r"[^\w\s-]", "", text.lower())
    return re.sub(r"[-\s]+", "-", text).strip("-")


def tokenize(text: str) -> set[str]:
    """Tokenize text into lowercased alphanumeric word tokens, ignoring short stopwords."""
    stopwords = {
        "the",
        "and",
        "for",
        "with",
        "that",
        "this",
        "from",
        "into",
        "over",
        "after",
        "against",
        "during",
        "cricket",
        "match",
        "team",
        "win",
        "won",
        "his",
        "her",
        "who",
        "was",
        "were",
        "out",
        "all",
    }
    # Strip possessives like "Sachin's" -> "Sachin"
    cleaned = re.sub(r"'s\b", "", text.lower())
    words = re.findall(r"[a-z0-9]+", cleaned)
    return {w for w in words if len(w) > 2 and w not in stopwords}


def jaccard_similarity(set_a: set[str], set_b: set[str]) -> float:
    """Compute Jaccard token overlap between two sets of tokens."""
    if not set_a or not set_b:
        return 0.0
    intersection = len(set_a & set_b)
    union = len(set_a | set_b)
    return intersection / union if union > 0 else 0.0


def text_similarity(text_a: str, text_b: str) -> float:
    """Compute combined fuzzy sequence matcher and Jaccard token similarity."""
    if not text_a or not text_b:
        return 0.0
    if text_a.strip().lower() == text_b.strip().lower():
        return 1.0

    seq_ratio = difflib.SequenceMatcher(
        None, text_a.lower(), text_b.lower()
    ).ratio()
    tokens_a = tokenize(text_a)
    tokens_b = tokenize(text_b)
    token_ratio = jaccard_similarity(tokens_a, tokens_b)

    # Weighted combination: 40% sequence matching, 60% token semantic overlap
    return 0.4 * seq_ratio + 0.6 * token_ratio


def generate_canonical_key(entry: dict[str, Any]) -> str:
    """Generate a stable canonical content_key from entry metadata."""
    if entry.get("content_key"):
        return entry["content_key"]

    cat = entry.get("category", "story")
    year = entry.get("year")
    title = entry.get("title", "")
    players = entry.get("players", [])
    teams = entry.get("teams", [])

    parts = [cat]
    if year:
        parts.append(str(year))
    if teams:
        teams_slug = "-vs-".join(slugify(t)[:6] for t in teams[:2])
        parts.append(teams_slug)
    if players:
        player_slug = slugify(players[0])[:16]
        parts.append(player_slug)
    if title:
        title_slug = slugify(title)[:24]
        parts.append(title_slug)

    return ":".join(p for p in parts if p)


def check_duplicate(
    candidate: dict[str, Any],
    existing_entries: list[dict[str, Any]],
    similarity_threshold: float = 0.68,
) -> tuple[bool, dict[str, Any] | None, float, str]:
    """Check if candidate story is a duplicate or overlap of any existing entry.

    Returns: (is_duplicate, matching_entry, max_similarity, reason)
    """
    candidate_key = candidate.get("content_key", "")
    candidate_title = candidate.get("title", "")
    candidate_summary = candidate.get("summary", "")
    candidate_text = f"{candidate_title} {candidate_summary} {' '.join(candidate.get('segments', []))}"
    candidate_year = candidate.get("year")
    candidate_teams = {t.lower() for t in candidate.get("teams", [])}
    candidate_players = {p.lower() for p in candidate.get("players", [])}

    for existing in existing_entries:
        existing_key = existing.get("content_key", "")
        # 1. Exact key match
        if candidate_key and existing_key and candidate_key == existing_key:
            return True, existing, 1.0, "exact_content_key"

        existing_title = existing.get("title", "")
        existing_summary = existing.get("summary", "")
        existing_text = f"{existing_title} {existing_summary} {' '.join(existing.get('segments', []))}"

        # 2. Text / semantic similarity
        title_sim = text_similarity(candidate_title, existing_title)
        if title_sim >= 0.85:
            return True, existing, title_sim, "high_title_similarity"

        full_sim = text_similarity(candidate_text, existing_text)
        if full_sim >= similarity_threshold:
            return True, existing, full_sim, "high_content_similarity"

        # 3. Entity overlap check (Same year + overlapping teams + overlapping primary player)
        existing_year = existing.get("year")
        existing_teams = {t.lower() for t in existing.get("teams", [])}
        existing_players = {p.lower() for p in existing.get("players", [])}

        if (
            candidate_year
            and existing_year
            and candidate_year == existing_year
            and candidate_teams
            and existing_teams
            and (candidate_teams & existing_teams)
        ):
            # Same match context: check if player matches or title/summary has moderate overlap
            if (candidate_players & existing_players) or (
                text_similarity(candidate_summary, existing_summary) >= 0.50
            ):
                return True, existing, max(full_sim, 0.75), "entity_match_overlap"

    return False, None, 0.0, "unique"


def enrich_story(
    existing: dict[str, Any], candidate: dict[str, Any]
) -> dict[str, Any]:
    """Enrich an existing story with additional metadata or alternate segments from a candidate."""
    enriched = dict(existing)

    # Merge tags
    existing_tags = set(enriched.get("tags", []))
    candidate_tags = set(candidate.get("tags", []))
    enriched["tags"] = sorted(list(existing_tags | candidate_tags))

    # Merge players
    existing_players = set(enriched.get("players", []))
    candidate_players = set(candidate.get("players", []))
    enriched["players"] = sorted(list(existing_players | candidate_players))

    # Merge teams
    existing_teams = set(enriched.get("teams", []))
    candidate_teams = set(candidate.get("teams", []))
    enriched["teams"] = sorted(list(existing_teams | candidate_teams))

    # If existing is missing event date or venue, fill from candidate
    if not enriched.get("event_month_day") and candidate.get("event_month_day"):
        enriched["event_month_day"] = candidate["event_month_day"]
    if not enriched.get("venue") and candidate.get("venue"):
        enriched["venue"] = candidate["venue"]
    if not enriched.get("year") and candidate.get("year"):
        enriched["year"] = candidate["year"]

    return enriched
