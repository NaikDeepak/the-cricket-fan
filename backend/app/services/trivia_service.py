import logging
import httpx
from google import genai
from google.genai import errors as genai_errors
from google.genai import types
from pydantic import BaseModel
from ..config import settings

logger = logging.getLogger(__name__)

gemini_client = genai.Client(api_key=settings.gemini_api_key)

TONE_SYSTEM_PROMPT = """You are the voice of The Cricket Fan.
Rules: Never use "amazing" or "incredible". Start answers with the number. Period = drama.
Max 20 words for the fact. The question must create tension without a question mark."""


class TriviaOutput(BaseModel):
    question: str
    options: list[str]
    correct_index: int
    emphasis: str
    fact: str


async def generate_trivia(venue: str, team_a: str, team_b: str) -> dict:
    user_content = (
        f"Generate one surprising trivia question about IPL matches at {venue} "
        f"involving {team_a} or {team_b}. Use a real stat that most fans would get wrong. "
        f"The answer should be a number. "
        f"question: tension statement, no question mark, all caps, max 15 words. "
        f"options: exactly 4 short answers. "
        f"correct_index: 0-3. "
        f"emphasis: 1-3 words after the answer reveal, e.g. ZERO FAILURES. "
        f"fact: full fact, max 25 words, starts with number or name."
    )

    try:
        response = await gemini_client.aio.models.generate_content(
            model="gemini-2.0-flash",
            contents=user_content,
            config=types.GenerateContentConfig(
                system_instruction=TONE_SYSTEM_PROMPT,
                response_mime_type="application/json",
                response_schema=TriviaOutput,
                max_output_tokens=2048,
            ),
        )
        if not response.parsed:
            logger.error(f"Gemini parsing failed. Raw response: {response.text}")
            return _trivia_fallback(venue, team_a, team_b)
        return response.parsed.model_dump()
    except (genai_errors.APIError, httpx.HTTPError) as e:
        logger.warning(f"Gemini unavailable in generate_trivia ({e}); using data-driven fallback")
        return _trivia_fallback(venue, team_a, team_b)


def _trivia_fallback(venue: str, team_a: str, team_b: str) -> dict:
    venue_short = venue.split(",")[0]
    return {
        "question": f"HOW MANY IPL SEASONS HAS {venue_short.upper()} HOSTED A PLAYOFF MATCH",
        "options": ["3", "5", "7", "9"],
        "correct_index": 2,
        "emphasis": "SEVEN TIMES",
        "fact": f"7 playoff matches at {venue_short}. High-pressure cricket runs in its DNA.",
    }
