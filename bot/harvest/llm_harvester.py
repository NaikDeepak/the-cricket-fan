"""AI-driven Obscure Cricket Lore Harvester.

Uses Gemini API to probe for obscure, forgotten, and domestic cricket milestones,
bizarre dismissals, and legendary county/Ranji/Shield moments.
"""

import json
import logging
import os
import re
from typing import Any

logger = logging.getLogger(__name__)

OBSCURE_SEED_PROMPTS = [
    "Find 3 obscure Ranji Trophy or domestic cricket finishes from 1980-2020 with bizarre twists or incredible last-wicket heroics.",
    "Find 3 forgotten Associate Nation World Cup upsets or heroic performances (e.g. Ireland vs Pakistan 2007, Kenya 2003, Netherlands vs England 2009).",
    "Find 3 bizarre cricket dismissals (e.g. timed out, obstructing the field, handling the ball, hit wicket after celebration) in international cricket.",
]


def harvest_llm_obscure_stories(prompt_override: str | None = None) -> list[dict[str, Any]]:
    """Query Gemini to generate obscure, fact-checked cricket stories formatted as JSON cards."""
    try:
        from composer.gemini import generate_content
    except Exception:
        logger.info("Gemini client not available; returning empty LLM candidates")
        return []

    prompt_text = prompt_override or OBSCURE_SEED_PROMPTS[0]
    full_prompt = f"""You are a cricket historian for 'The Cricket Fan'.
{prompt_text}

For each story, output a strictly valid JSON array of objects with the following keys:
- title: str (Catchy, concise headline)
- summary: str (1-2 sentences summarizing the match context and turning point)
- category: str (one of 'story', 'anecdote', 'lore')
- format: str (either 'single' for 1 segment, or 'thread' for 2-3 segments)
- teams: list[str]
- players: list[str]
- venue: str
- year: int
- match_format: str (e.g. 'Test', 'ODI', 'T20', 'First-Class')
- tags: list[str] (e.g. ['obscure', 'upset', 'bizarre'])
- event_month_day: str or null (e.g. '03-17')
- segments: list[str] (each segment <= 280 chars formatted as an engaging tweet with #Cricket #TheCricketFan)

Return ONLY valid JSON array. No markdown code fences.
"""
    try:
        # generate_content's signature is (prompt, category, api_key) -> dict,
        # not (prompt) -> str. Its own response schema is {"text", "card_meta"};
        # since our prompt asks for a raw JSON array (no "text" key), the
        # array fails that shape check and falls through to the fallback
        # branch, which returns the raw model text unchanged under "text" —
        # exactly the JSON-array string this function expects to parse below.
        api_key = os.environ.get("GEMINI_API_KEY", "")
        result = generate_content(full_prompt, "lore", api_key)
        raw_text = result["text"]
        # Clean potential markdown backticks
        clean = re.sub(r"^```json\s*", "", raw_text.strip())
        clean = re.sub(r"^```\s*", "", clean)
        clean = re.sub(r"\s*```$", "", clean)
        items = json.loads(clean)
        if isinstance(items, list):
            for it in items:
                it["source_type"] = "llm_discovery"
                it["source_ref"] = "gemini:obscure_lore_agent"
                if not it.get("content_key"):
                    title_slug = re.sub(r"[^\w\s-]", "", it.get("title", "obscure").lower())
                    title_slug = re.sub(r"[-\s]+", "-", title_slug).strip("-")[:24]
                    it["content_key"] = f"lore:llm-{it.get('year', 2000)}-{title_slug}"
            return items
    except Exception as e:
        logger.warning("Failed to harvest LLM stories: %s", e)
    return []
