import json

from pydantic import BaseModel


class DraftIn(BaseModel):
    source: str
    category: str | None = None
    text: str
    card_type: str | None = None
    card_meta: dict | None = None
    content_key: str | None = None


class DraftPatch(BaseModel):
    text: str | None = None
    category: str | None = None
    card_type: str | None = None
    card_meta: dict | None = None


class DraftOut(BaseModel):
    id: int
    source: str
    category: str | None
    text: str
    card_type: str | None
    card_meta: dict | None
    status: str
    created_at: object
    posted_at: object
    content_key: str | None = None


class EventIn(BaseModel):
    action: str
    platform_hint: str | None = None


class ContentBankOut(BaseModel):
    content_key: str
    category: str
    format: str
    segments: list[str]
    source: str
    last_used_days: int | None = None
    event_month_day: str | None = None
    on_this_day: bool = False


class StoryOut(BaseModel):
    content_key: str
    category: str
    format: str
    segments: list[str]
    source: str
    title: str | None = None
    summary: str | None = None
    source_type: str | None = None
    source_ref: str | None = None
    teams: list[str] = []
    players: list[str] = []
    venue: str | None = None
    year: int | None = None
    match_format: str | None = None
    tags: list[str] = []
    is_published: bool = True


class WireItemOut(BaseModel):
    id: int
    category: str | None = None
    text: str
    posted_at: object
    content_key: str | None = None


class GenerateBotIn(BaseModel):
    kind: str  # 'prediction' | 'trivia' | 'h2h' | 'venue' | 'record'
    fixture_id: int | None = None


class GenerateLlmIn(BaseModel):
    prompt: str
    category: str | None = None


class CategoryCount(BaseModel):
    category: str | None
    drafts: int


class AnalyticsOut(BaseModel):
    funnel: dict[str, int]
    event_totals: dict[str, int]
    by_category: list[CategoryCount]
    prediction_record: dict[str, int]


class PredictionOut(BaseModel):
    id: int
    fixture_id: int
    team_a: str
    team_b: str
    venue: str
    league: str
    start_time: object
    prob_team_a: float
    reasons: list[str]
    outcome: str
    created_at: object


class PostOut(BaseModel):
    id: int
    fixture_id: int | None
    post_type: str
    state: str
    text: str | None
    tweet_count: int
    posted_at: object
    team_a: str | None = None
    team_b: str | None = None


def row_to_out(row) -> DraftOut:
    return DraftOut(
        id=row.id,
        source=row.source,
        category=row.category,
        text=row.text,
        card_type=row.card_type,
        card_meta=json.loads(row.card_meta_json) if row.card_meta_json else None,
        status=row.status,
        created_at=row.created_at,
        posted_at=row.posted_at,
        content_key=row.content_key,
    )
