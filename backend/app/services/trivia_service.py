from google import genai
from google.genai import types
from pydantic import BaseModel
from fastapi import HTTPException
from ..config import settings

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
                max_output_tokens=512,
            ),
        )
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"AI service unavailable: {e}")

    if not response.parsed:
        raise HTTPException(status_code=502, detail="AI returned unexpected response format")

    return response.parsed.model_dump()
