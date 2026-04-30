import logging
from google import genai
from google.genai import types
from pydantic import BaseModel
from ..config import settings

logger = logging.getLogger(__name__)

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
                max_output_tokens=2048,
            ),
        )
        if not response.parsed:
            logger.error(f"Gemini parsing failed. Raw response: {response.text}")
            return _story_fallback(stats)
        return response.parsed.model_dump()
    except Exception as e:
        logger.warning(f"Gemini unavailable in generate_story ({e}); using data-driven fallback")
        return _story_fallback(stats)


def _story_fallback(stats: dict) -> dict:
    batsman = stats.get("featured_batsman", "")
    bowler = stats.get("featured_bowler", "")
    dismissals = stats.get("featured_dismissals", 0)
    team_a = stats["team_a"]["short_name"]
    team_b = stats["team_b"]["short_name"]
    venue_short = stats["venue"].split(",")[0]
    chase_pct = stats.get("team_a_chase_pct", 0)

    if batsman and bowler and dismissals:
        b_last = bowler.split()[-1].upper()
        bat_last = batsman.split()[-1].upper()
        headline = f"{b_last} OWNS {bat_last}. {dismissals} TIMES. TONIGHT COUNTS."
        return {
            "headline": headline,
            "shock_stat": {
                "value": str(dismissals),
                "label": f"{b_last} DISMISSALS",
                "one_liner": f"{dismissals} times in 2 seasons. {batsman.split()[0]} has no answer.",
            },
        }

    headline = f"{team_a} VS {team_b}. {venue_short.upper()}. TONIGHT."
    return {
        "headline": headline,
        "shock_stat": {
            "value": f"{chase_pct}%",
            "label": f"{team_a} WIN % HERE",
            "one_liner": f"{chase_pct}% win rate at {venue_short}. Numbers don't lie.",
        },
    }
