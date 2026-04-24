import anthropic
from ..config import settings

anthropic_client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

TONE_SYSTEM_PROMPT = """You are the voice of The Cricket Fan — a fan who has watched every IPL season since 2008.
Rules:
- Never start with "The" or "A". Start with a name, number, or verb.
- Period is a dramatic device. Short sentences hit harder.
- Max 12 words per headline. Active voice always.
- Forbidden words: incredible, amazing, phenomenal, epic, masterclass, passionate fans, nail-biting, world-class.
- Allowed: owns, haunts, chokes, dominates, raw numbers, tonight, never, every time.
- Opinions stated as facts."""

STORY_TOOL = {
    "name": "generate_match_story",
    "description": "Generate match story headline and shock stat",
    "input_schema": {
        "type": "object",
        "properties": {
            "headline": {
                "type": "string",
                "description": "Max 10 words. Pattern: [PLAYER] [VERB] [STAT] [TIME CONTEXT]. All caps."
            },
            "shock_stat": {
                "type": "object",
                "properties": {
                    "value": {"type": "string", "description": "The raw number or short value"},
                    "label": {"type": "string", "description": "Max 5 words, all caps"},
                    "one_liner": {"type": "string", "description": "Max 15 words, starts with number or name"}
                },
                "required": ["value", "label", "one_liner"]
            }
        },
        "required": ["headline", "shock_stat"]
    }
}

async def generate_story(stats: dict) -> dict:
    user_content = (
        f"Today's match: {stats['team_a']['short_name']} vs {stats['team_b']['short_name']} "
        f"at {stats['venue']}.\n"
        f"Key stats:\n"
        f"- Rohit Sharma has scored 0 fifties vs CSK in his last 10 IPL matches\n"
        f"- {stats['team_a']['short_name']} win rate at {stats['venue']}: {stats['mi_win_pct']}%\n"
        f"- Jadeja has dismissed Rohit {stats['jadeja_dismissals']} times\n"
        f"Generate the headline and shock stat. Make it feel like a newspaper back page."
    )

    response = await anthropic_client.messages.create(
        model="claude-opus-4-7",
        max_tokens=512,
        system=[{"type": "text", "text": TONE_SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
        tools=[STORY_TOOL],
        tool_choice={"type": "tool", "name": "generate_match_story"},
        messages=[{"role": "user", "content": user_content}]
    )

    tool_use = next(b for b in response.content if b.type == "tool_use")
    return tool_use.input
