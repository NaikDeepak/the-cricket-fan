import json
import logging
import requests

logger = logging.getLogger(__name__)


class GeminiUnavailable(RuntimeError):
    pass


_SCHEMA_HINT = (
    "Return ONLY a JSON object with keys 'text' (a single cricket social-media "
    "post, own words, <=280 chars) and optional 'card_meta' (a flat object of "
    "short display fields like headline/subject). No markdown, no prose outside JSON."
)


def generate_content(prompt: str, category: str | None, api_key: str) -> dict:
    if not api_key:
        raise GeminiUnavailable("GEMINI_API_KEY not configured")

    full = f"{_SCHEMA_HINT}\nCategory: {category or 'anecdote'}\nRequest: {prompt}"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": full}]}],
        "generationConfig": {"responseMimeType": "application/json"},
    }

    try:
        resp = requests.post(url, json=payload, timeout=25)
        if resp.status_code != 200:
            logger.error("Gemini API error: %s - %s", resp.status_code, resp.text)
            raise GeminiUnavailable(f"Gemini API returned HTTP {resp.status_code}")
        
        data_json = resp.json()
        raw_text = data_json["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:
        if isinstance(e, GeminiUnavailable):
            raise
        logger.error("Gemini request failed: %s", e)
        raise GeminiUnavailable(f"Failed to generate content: {e}") from e

    try:
        data = json.loads(raw_text)
        return {"text": data["text"], "card_meta": data.get("card_meta")}
    except (json.JSONDecodeError, KeyError, TypeError):
        return {"text": (raw_text or "").strip(), "card_meta": None}
