import anthropic
from ..config import settings

anthropic_client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

TONE_SYSTEM_PROMPT = """You are the voice of The Cricket Fan.
Rules: Never use "amazing" or "incredible". Start answers with the number. Period = drama.
Max 20 words for the fact. The question must create tension without a question mark."""

TRIVIA_TOOL = {
    "name": "generate_trivia",
    "description": "Generate one trivia question from IPL history",
    "input_schema": {
        "type": "object",
        "properties": {
            "question": {"type": "string", "description": "Tension statement, no question mark, all caps, max 15 words"},
            "options": {"type": "array", "items": {"type": "string"}, "description": "Exactly 4 options (numbers or short answers)"},
            "correct_index": {"type": "integer", "description": "0-3 index of correct option"},
            "emphasis": {"type": "string", "description": "1-3 words after the answer reveal, e.g. ZERO FAILURES. or NOT ONCE."},
            "fact": {"type": "string", "description": "Full fact, max 25 words, starts with number or name"},
        },
        "required": ["question", "options", "correct_index", "emphasis", "fact"]
    }
}

async def generate_trivia(venue: str, team_a: str, team_b: str) -> dict:
    user_content = (
        f"Generate one surprising trivia question about IPL matches at {venue} "
        f"involving {team_a} or {team_b}. Use a real stat that most fans would get wrong. "
        f"The answer should be a number."
    )

    response = anthropic_client.messages.create(
        model="claude-opus-4-7",
        max_tokens=512,
        system=[{"type": "text", "text": TONE_SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
        tools=[TRIVIA_TOOL],
        tool_choice={"type": "tool", "name": "generate_trivia"},
        messages=[{"role": "user", "content": user_content}]
    )

    tool_use = next(b for b in response.content if b.type == "tool_use")
    return tool_use.input
