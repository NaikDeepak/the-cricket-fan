from google import genai
from google.genai import types
from pydantic import BaseModel
from fastapi import HTTPException
from ..config import settings

gemini_client = genai.Client(api_key=settings.gemini_api_key)

TONE_SYSTEM_PROMPT = """You are the voice of The Cricket Fan — a fan who has watched every IPL season since 2008.
Rules:
- Never start with "The" or "A". Start with a name, number, or verb.
- Period is a dramatic device. Short sentences hit harder.
- Max 12 words per headline. Active voice always.
- Forbidden words: incredible, amazing, phenomenal, epic, masterclass, passionate fans, nail-biting, world-class.
- Allowed: owns, haunts, chokes, dominates, raw numbers, tonight, never, every time.
- Opinions stated as facts."""


class ShockStat(BaseModel):
    value: str
    label: str
    one_liner: str


class StoryOutput(BaseModel):
    headline: str
    shock_stat: ShockStat


async def generate_story(stats: dict) -> dict:
    batsman = stats.get("featured_batsman", "")
    bowler = stats.get("featured_bowler", "")
    dismissals = stats.get("featured_dismissals", 0)
    chase_pct = stats.get("team_a_chase_pct", 0)

    user_content = (
        f"Today's match: {stats['team_a']['short_name']} vs {stats['team_b']['short_name']} "
        f"at {stats['venue']}.\n"
        f"Key stats:\n"
        f"- Featured battle: {batsman} (bat) vs {bowler} (bowl), {dismissals} dismissals in last 2 seasons\n"
        f"- {stats['team_a']['short_name']} win rate at this venue: {chase_pct}%\n"
        f"Generate the headline and shock stat. Make it feel like a newspaper back page. "
        f"headline: max 10 words, pattern [PLAYER] [VERB] [STAT] [TIME CONTEXT], all caps. "
        f"shock_stat.value: the raw number or short value (e.g. dismissal count). "
        f"shock_stat.label: max 5 words, all caps. "
        f"shock_stat.one_liner: max 15 words, starts with number or name."
    )

    try:
        response = await gemini_client.aio.models.generate_content(
            model="gemini-2.0-flash",
            contents=user_content,
            config=types.GenerateContentConfig(
                system_instruction=TONE_SYSTEM_PROMPT,
                response_mime_type="application/json",
                response_schema=StoryOutput,
                max_output_tokens=512,
            ),
        )
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"AI service unavailable: {e}")

    if not response.parsed:
        raise HTTPException(status_code=502, detail="AI returned unexpected response format")

    return response.parsed.model_dump()
