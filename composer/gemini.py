import json


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
    import google.generativeai as genai

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.5-flash")
    full = f"{_SCHEMA_HINT}\nCategory: {category or 'anecdote'}\nRequest: {prompt}"
    resp = model.generate_content(
        full, generation_config={"response_mime_type": "application/json"}
    )
    try:
        data = json.loads(resp.text)
        return {"text": data["text"], "card_meta": data.get("card_meta")}
    except (json.JSONDecodeError, KeyError, AttributeError):
        return {"text": (resp.text or "").strip(), "card_meta": None}
