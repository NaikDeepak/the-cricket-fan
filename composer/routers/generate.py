import random
from datetime import datetime, timezone

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, Request

from bot.compose import prediction_post, trivia_post
from bot.db import drafts, fixtures
from bot.features import build_features
from bot.predict import predict
from bot.run import _home_team_at_venue, _load_team_matches
from bot.trivia_standalone import build_candidates

from ..deps import get_conn
from ..gemini import GeminiUnavailable
from ..gemini import generate_content as gemini_generate
from ..schemas import DraftIn, DraftOut, GenerateBotIn, GenerateLlmIn
from .drafts import create_draft

router = APIRouter()

MATCHUP_KINDS = {"prediction", "trivia"}
POOL_PREFIX = {"h2h": "h2h:", "venue": "venue:", "record": "record:"}


def _resolve_fixture(conn, fixture_id: int | None):
    if fixture_id is not None:
        row = conn.execute(
            sa.select(fixtures).where(fixtures.c.id == fixture_id)
        ).first()
        if row is None:
            raise HTTPException(404, f"fixture {fixture_id} not found")
        return row
    row = conn.execute(
        sa.select(fixtures)
        .where(fixtures.c.status == "upcoming")
        .order_by(fixtures.c.start_time.asc())
    ).first()
    if row is None:
        raise HTTPException(409, "no upcoming fixture to generate from")
    return row


@router.post("/generate/bot", response_model=DraftOut, status_code=201)
def generate_bot(
    body: GenerateBotIn, request: Request, conn=Depends(get_conn)
) -> DraftOut:
    df = _load_team_matches(conn)
    if body.kind in MATCHUP_KINDS:
        fx = _resolve_fixture(conn, body.fixture_id)
        if body.kind == "prediction":
            artifact = getattr(request.app.state, "artifact", None)
            if artifact is None:
                raise HTTPException(503, "prediction model artifact not loaded")
            home = _home_team_at_venue(df, fx.venue, fx.team_a, fx.team_b)
            feats = build_features(
                df,
                fx.team_a,
                fx.team_b,
                fx.venue,
                datetime.now(timezone.utc).date(),
                home_team=home,
            )
            prob, reasons = predict(artifact, feats)
            text = prediction_post(fx.team_a, fx.team_b, prob, reasons, fx.league)
            meta = {
                "team_a": fx.team_a,
                "team_b": fx.team_b,
                "prob_a": prob,
                "reasons": reasons,
            }
            return create_draft(
                conn,
                DraftIn(
                    source="bot",
                    category="prediction",
                    text=text,
                    card_type="prediction",
                    card_meta=meta,
                ),
                log_generated=True,
            )
        text = trivia_post(df, fx.team_a, fx.team_b, fx.venue)
        meta = {"team_a": fx.team_a, "team_b": fx.team_b}
        return create_draft(
            conn,
            DraftIn(
                source="bot",
                category="trivia",
                text=text,
                card_type="trivia",
                card_meta=meta,
            ),
            log_generated=True,
        )
    prefix = POOL_PREFIX.get(body.kind)
    if prefix is None:
        raise HTTPException(422, f"unknown kind {body.kind!r}")
    matches = [c for c in build_candidates(df) if c[0].startswith(prefix)]
    if not matches:
        raise HTTPException(
            409, f"no {body.kind} candidate available from current data"
        )
    recent = _recent_content_keys(conn)
    pool = [c for c in matches if c[0] not in recent]
    if not pool:
        pool = matches  # every candidate already drafted -- repeat beats a dead end
    key, _fmt, segments = random.choice(pool)
    return create_draft(
        conn,
        DraftIn(
            source="bot",
            category=body.kind,
            text=segments[0],
            card_type="record",
            content_key=key,
        ),
        log_generated=True,
    )


def _recent_content_keys(conn) -> set[str]:
    rows = conn.execute(
        sa.select(drafts.c.content_key).where(drafts.c.content_key.is_not(None))
    ).all()
    return {r.content_key for r in rows}


def _gemini_key() -> str:
    from ..config import get_settings

    return get_settings().gemini_api_key


@router.post("/generate/llm", response_model=DraftOut, status_code=201)
def generate_llm(body: GenerateLlmIn, conn=Depends(get_conn)) -> DraftOut:
    key = _gemini_key()
    try:
        result = gemini_generate(body.prompt, body.category, key)
    except GeminiUnavailable as e:
        raise HTTPException(503, f"LLM generation unavailable: {e}") from e
    return create_draft(
        conn,
        DraftIn(
            source="llm",
            category=body.category,
            text=result["text"],
            card_type="record",
            card_meta=result.get("card_meta"),
        ),
        log_generated=True,
    )
