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
    id: int
    content_key: str
    category: str
    format: str
    segments: list[str]
    source: str
    last_used_days: int | None = None
    event_month_day: str | None = None
    on_this_day: bool = False
    is_published: bool = True


class PublishIn(BaseModel):
    is_published: bool


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
    event_month_day: str | None = None


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


class GenerateRecapIn(BaseModel):
    team_a: str
    team_b: str


class CategoryCount(BaseModel):
    category: str | None
    drafts: int


class AnalyticsOut(BaseModel):
    funnel: dict[str, int]
    event_totals: dict[str, int]
    by_category: list[CategoryCount]
    prediction_record: dict[str, int]


class LeagueAccuracyStats(BaseModel):
    league: str
    total: int
    evaluated: int
    correct: int
    incorrect: int
    accuracy_pct: int


class PredictionAccuracyStats(BaseModel):
    total: int
    evaluated: int
    pending: int
    correct: int
    incorrect: int
    void: int
    accuracy_pct: int
    streak: int
    streak_type: str  # 'win' | 'loss' | 'none'
    recent_outcomes: list[str]
    by_league: list[LeagueAccuracyStats]


class PredictionIn(BaseModel):
    team_a: str
    team_b: str
    league: str = "IPL"
    venue: str = "TBD"
    prob_team_a: float
    reasons: list[str] = []
    fixture_id: int | None = None
    actual_winner: str | None = None
    result_summary: str | None = None
    outcome: str = "pending"


class PredictionPatch(BaseModel):
    prob_team_a: float | None = None
    reasons: list[str] | None = None
    actual_winner: str | None = None
    result_summary: str | None = None
    outcome: str | None = None


class PredictionResultIn(BaseModel):
    actual_winner: str  # Winning team name, or "no_result" / "abandoned"
    result_summary: str | None = None
    outcome: str | None = None  # Explicit override: 'correct' | 'incorrect' | 'void'


class PredictionSettleFromTextIn(BaseModel):
    raw_text: str | None = None
    url: str | None = None


class PredictionOut(BaseModel):
    id: int
    fixture_id: int | None = None
    team_a: str
    team_b: str
    venue: str
    league: str
    start_time: object | None = None
    prob_team_a: float
    reasons: list[str] = []
    predicted_winner: str
    actual_winner: str | None = None
    result_summary: str | None = None
    outcome: str  # 'pending' | 'correct' | 'incorrect' | 'void'
    created_at: object
    evaluated_at: object | None = None


class TodayMatchOut(BaseModel):
    fixture_id: int
    team_a: str
    team_b: str
    league: str
    venue: str
    start_time: object | None = None
    fixture_status: str  # 'upcoming' | 'completed' | 'void'
    winner: str | None = None
    prediction: "PredictionOut | None" = None


class RunModelOut(BaseModel):
    status: str
    predictions_created: int
    predictions_skipped: int
    fixtures_found: int
    errors: list[str] = []


class SettleFromApiOut(BaseModel):
    status: str
    settled_count: int
    void_count: int
    errors: list[str] = []


class LastIngestedMatch(BaseModel):
    date: str
    league: str
    team_a: str
    team_b: str
    venue: str


class BacktestOptions(BaseModel):
    leagues: list[str]
    seasons_by_league: dict[str, list[str]]
    total_matches: int
    earliest_date: str | None = None
    latest_date: str | None = None
    last_match: LastIngestedMatch | None = None
    matches_by_league: dict[str, int] = {}


class BacktestGame(BaseModel):
    date: str
    team_a: str
    team_b: str
    venue: str
    prob_team_a: float
    predicted_winner: str
    actual_winner: str
    correct: bool


class BacktestResult(BaseModel):
    league: str
    season: str
    total: int
    correct: int
    accuracy_pct: int
    elo_accuracy_pct: int
    home_accuracy_pct: int
    games: list[BacktestGame]


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


class MatchParseIn(BaseModel):
    raw_text: str | None = None
    url: str | None = None


class MatchInputSchema(BaseModel):
    team_a: str
    team_b: str
    league: str = "T20"
    venue: str = ""
    toss_winner: str | None = None
    toss_decision: str | None = None  # 'bat' | 'field'
    innings1_team: str | None = None
    innings1_runs: int | None = None
    innings1_wickets: int | None = None
    innings1_overs: float | None = None
    innings2_team: str | None = None
    innings2_runs: int | None = None
    innings2_wickets: int | None = None
    innings2_overs: float | None = None
    phase: str = (
        "pre_match"  # 'pre_match' | 'innings_break' | 'chase_in_progress' | 'completed'
    )
    top_performers: list[dict] = []


class LivePredictionOut(BaseModel):
    team_a: str
    team_b: str
    prob_team_a: float
    reasons: list[str]
    phase: str
    score_projection: dict
    tweet_text: str
    card_meta: dict


class TeamColorThemeSchema(BaseModel):
    primary: str
    secondary: str
    accent: str | None = None
    gradient: str | None = None
    glow: str | None = None
    text_dark: bool = False


class TeamIn(BaseModel):
    name: str
    short_name: str
    league: str
    primary_color: str
    secondary_color: str
    accent_color: str | None = None
    gradient: str | None = None
    glow: str | None = None
    text_dark: bool = False
    logo_url: str | None = None
    aliases: list[str] = []
    is_active: bool = True


class TeamPatch(BaseModel):
    name: str | None = None
    short_name: str | None = None
    league: str | None = None
    primary_color: str | None = None
    secondary_color: str | None = None
    accent_color: str | None = None
    gradient: str | None = None
    glow: str | None = None
    text_dark: bool | None = None
    logo_url: str | None = None
    aliases: list[str] | None = None
    is_active: bool | None = None


class TeamOut(BaseModel):
    id: int
    name: str
    short_name: str
    league: str
    primary_color: str
    secondary_color: str
    accent_color: str | None = None
    gradient: str | None = None
    glow: str | None = None
    text_dark: bool = False
    logo_url: str | None = None
    aliases: list[str] = []
    is_active: bool = True
    theme: TeamColorThemeSchema


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


def team_row_to_out(row) -> TeamOut:
    accent = row.accent_color or row.primary_color
    gradient = (
        row.gradient
        or f"linear-gradient(135deg, {row.primary_color} 0%, {row.secondary_color} 100%)"
    )
    glow = row.glow or "rgba(255, 255, 255, 0.4)"
    theme = TeamColorThemeSchema(
        primary=row.primary_color,
        secondary=row.secondary_color,
        accent=accent,
        gradient=gradient,
        glow=glow,
        text_dark=bool(row.text_dark),
    )
    aliases = json.loads(row.aliases_json) if row.aliases_json else []
    return TeamOut(
        id=row.id,
        name=row.name,
        short_name=row.short_name,
        league=row.league,
        primary_color=row.primary_color,
        secondary_color=row.secondary_color,
        accent_color=accent,
        gradient=gradient,
        glow=glow,
        text_dark=bool(row.text_dark),
        logo_url=row.logo_url,
        aliases=aliases,
        is_active=bool(row.is_active),
        theme=theme,
    )


class HarvestIn(BaseModel):
    sources: list[str] = ["wikipedia", "reddit", "quora", "cricsheet"]
    commit: bool = True
    threshold: float = 0.68


class DuplicateReportOut(BaseModel):
    candidate_key: str
    candidate_title: str
    matched_key: str | None = None
    score: float
    reason: str


class HarvestOut(BaseModel):
    harvested_total: int
    inserted: int
    skipped_duplicates: int
    enriched: int
    novel_candidates: list[dict] = []
    duplicate_reports: list[DuplicateReportOut] = []

