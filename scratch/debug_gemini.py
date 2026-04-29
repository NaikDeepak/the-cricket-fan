
import asyncio
import os
from google import genai
from google.genai import types
from pydantic import BaseModel

# Mocking settings
GEMINI_API_KEY = "AIzaSyB9wA0d2Jxe1g66fAEqKbi6I0hYJdRp6lI"

class ShockStat(BaseModel):
    value: str
    label: str
    one_liner: str

class StoryOutput(BaseModel):
    headline: str
    shock_stat: ShockStat

async def main():
    client = genai.Client(api_key=GEMINI_API_KEY)
    
    TONE_SYSTEM_PROMPT = """You are the voice of The Cricket Fan — a fan who has watched every IPL season since 2008.
Rules:
- Never start with "The" or "A". Start with a name, number, or verb.
- Period is a dramatic device. Short sentences hit harder.
- Max 12 words per headline. Active voice always.
- Forbidden words: incredible, amazing, phenomenal, epic, masterclass, passionate fans, nail-biting, world-class.
- Allowed: owns, haunts, chokes, dominates, raw numbers, tonight, never, every time.
- Opinions stated as facts."""

    user_content = (
        "Today's match: MI vs CSK at Wankhede.\n"
        "Key stats:\n"
        "- Featured battle: Virat Kohli (bat) vs Jasprit Bumrah (bowl), 5 dismissals in last 2 seasons\n"
        "- MI win rate at this venue: 60%\n"
        "Generate the headline and shock stat. Make it feel like a newspaper back page. "
        "headline: max 10 words, pattern [PLAYER] [VERB] [STAT] [TIME CONTEXT], all caps. "
        "shock_stat.value: the raw number or short value (e.g. dismissal count). "
        "shock_stat.label: max 5 words, all caps. "
        "shock_stat.one_liner: max 15 words, starts with number or name."
    )

    print(f"Calling Gemini with model: gemini-3-flash-preview...")
    try:
        response = await client.aio.models.generate_content(
            model="gemini-3-flash-preview",
            contents=user_content,
            config=types.GenerateContentConfig(
                system_instruction=TONE_SYSTEM_PROMPT,
                # response_mime_type="application/json",
                # response_schema=StoryOutput,
                max_output_tokens=512,
            ),
        )
        print("--- Response Text ---")
        print(response.text)
        print("--- Response Parsed ---")
        print(response.parsed)
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
