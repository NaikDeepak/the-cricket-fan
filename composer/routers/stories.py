import json
import re

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException

from bot.db import content_bank, drafts, fixtures

from ..deps import get_conn
from ..schemas import StoryOut, WireItemOut

router = APIRouter()


def _row_to_story(r) -> StoryOut:
    teams = json.loads(r.teams_json) if r.teams_json else []
    players = json.loads(r.players_json) if r.players_json else []
    tags = json.loads(r.tags_json) if r.tags_json else []
    segments = json.loads(r.segments_json) if r.segments_json else []
    src = (r.source or "").lower()
    key = (r.content_key or "").lower()
    inferred_source_type = r.source_type
    if not inferred_source_type:
        if "reddit" in src or "reddit" in key or "lore:" in key:
            inferred_source_type = "reddit"
        elif "quora" in src or "quora" in key:
            inferred_source_type = "quora"
        elif "memoir" in src or "memoir" in key or "autobiograph" in src:
            inferred_source_type = "memoir"
        elif "interview" in src or "interview" in key:
            inferred_source_type = "interview"
        elif "cricsheet" in src or "cricsheet" in key:
            inferred_source_type = "cricsheet"
        else:
            inferred_source_type = "wikipedia"

    return StoryOut(
        content_key=r.content_key,
        category=r.category,
        format=r.format,
        segments=segments,
        source=r.source,
        title=r.title or r.content_key,
        summary=r.summary or (segments[0] if segments else ""),
        source_type=inferred_source_type,
        source_ref=r.source_ref or r.source,
        teams=teams,
        players=players,
        venue=r.venue,
        year=r.year,
        match_format=r.match_format,
        tags=tags,
        is_published=bool(r.is_published) if r.is_published is not None else True,
        event_month_day=r.event_month_day,
    )


@router.get("/stories", response_model=list[StoryOut])
def list_stories(
    search: str | None = None,
    category: str | None = None,
    source_type: str | None = None,
    tag: str | None = None,
    team: str | None = None,
    player: str | None = None,
    venue: str | None = None,
    year: int | None = None,
    limit: int = 100,
    offset: int = 0,
    conn=Depends(get_conn),
) -> list[StoryOut]:
    q = sa.select(content_bank).order_by(content_bank.c.id.desc())
    if category:
        q = q.where(content_bank.c.category == category)
    if venue:
        q = q.where(content_bank.c.venue.ilike(f"%{venue}%"))
    if year:
        q = q.where(content_bank.c.year == year)
    q = q.where(
        sa.or_(
            content_bank.c.is_published.is_(True),
            content_bank.c.is_published.is_(
                None
            ),  # pre-migration rows count as published
        )
    )

    rows = conn.execute(q).all()
    results = []
    for r in rows:
        story = _row_to_story(r)
        if source_type:
            s_type_lower = source_type.lower()
            story_type = (story.source_type or "").lower()
            if s_type_lower == "memoir_quora":
                if story_type not in ["quora", "memoir", "interview"]:
                    continue
            elif s_type_lower not in story_type:
                continue
        if tag:
            t_search = tag.lower().lstrip("#")
            if not any(t_search in t.lower() for t in story.tags):
                continue
        if team:
            t_lower = team.lower()
            if not any(t_lower in t.lower() for t in story.teams):
                continue
        if player:
            p_lower = player.lower()
            if not any(p_lower in p.lower() for p in story.players):
                continue
        if search:
            s_lower = search.lower()
            haystack = (
                f"{story.title} {story.summary} {' '.join(story.segments)} "
                f"{' '.join(story.teams)} {' '.join(story.players)} {' '.join(story.tags)} "
                f"{story.venue or ''} {story.source_type or ''} {story.match_format or ''}"
            ).lower()
            if s_lower not in haystack:
                continue
        results.append(story)

    return results[offset : offset + limit]


@router.get("/stories/contextual", response_model=list[StoryOut])
def get_contextual_stories(
    fixture_id: int | None = None,
    team_a: str | None = None,
    team_b: str | None = None,
    venue: str | None = None,
    conn=Depends(get_conn),
) -> list[StoryOut]:
    if fixture_id:
        frow = conn.execute(
            sa.select(fixtures).where(fixtures.c.id == fixture_id)
        ).first()
        if frow:
            team_a = team_a or frow.team_a
            team_b = team_b or frow.team_b
            venue = venue or frow.venue

    q = sa.select(content_bank).where(
        sa.or_(
            content_bank.c.is_published.is_(True),
            content_bank.c.is_published.is_(
                None
            ),  # pre-migration rows count as published
        )
    )
    rows = conn.execute(q).all()
    stories = [_row_to_story(r) for r in rows]
    matches = []
    for s in stories:
        score = 0
        if team_a and any(team_a.lower() in t.lower() for t in s.teams):
            score += 2
        if team_b and any(team_b.lower() in t.lower() for t in s.teams):
            score += 2
        if venue and s.venue and venue.lower() in s.venue.lower():
            score += 1
        if score > 0:
            matches.append((score, s))

    matches.sort(key=lambda x: x[0], reverse=True)
    return [m[1] for m in matches[:5]]


@router.get("/stories/wire", response_model=list[WireItemOut])
def get_wire(limit: int = 12, conn=Depends(get_conn)) -> list[WireItemOut]:
    rows = conn.execute(
        sa.select(drafts)
        .where(drafts.c.status == "posted")
        .order_by(drafts.c.posted_at.desc(), drafts.c.id.desc())
        .limit(limit)
    ).all()
    return [
        WireItemOut(
            id=r.id,
            category=r.category,
            text=r.text,
            posted_at=r.posted_at,
            content_key=r.content_key,
        )
        for r in rows
    ]


@router.get("/stories/on-this-day", response_model=StoryOut)
def get_on_this_day_story(
    date: str | None = None,
    conn=Depends(get_conn),
) -> StoryOut:
    from bot.harvest.on_this_day import resolve_on_this_day_story

    story_dict = resolve_on_this_day_story(conn, date)
    return StoryOut(
        content_key=story_dict["content_key"],
        category=story_dict.get("category", "story"),
        format=story_dict.get("format", "single"),
        segments=story_dict.get("segments", []),
        source=story_dict.get("source", "calendar"),
        title=story_dict.get("title", story_dict["content_key"]),
        summary=story_dict.get("summary", ""),
        source_type=story_dict.get("source_type", "wikipedia"),
        source_ref=story_dict.get("source_ref", story_dict.get("source", "")),
        teams=story_dict.get("teams", []),
        players=story_dict.get("players", []),
        venue=story_dict.get("venue"),
        year=story_dict.get("year"),
        match_format=story_dict.get("match_format"),
        tags=story_dict.get("tags", []),
        is_published=story_dict.get("is_published", True),
        event_month_day=story_dict.get("event_month_day"),
    )


@router.get("/stories/{content_key}", response_model=StoryOut)
def get_story_by_key(content_key: str, conn=Depends(get_conn)) -> StoryOut:
    r = conn.execute(
        sa.select(content_bank).where(content_bank.c.content_key == content_key)
    ).first()
    if not r:
        if "on-this-day" in content_key or "today" in content_key:
            m = re.search(r"(\d{2}-\d{2})", content_key)
            month_day = m.group(1) if m else None
            from bot.harvest.on_this_day import resolve_on_this_day_story

            story_dict = resolve_on_this_day_story(conn, month_day)
            return StoryOut(
                content_key=story_dict["content_key"],
                category=story_dict.get("category", "story"),
                format=story_dict.get("format", "single"),
                segments=story_dict.get("segments", []),
                source=story_dict.get("source", "calendar"),
                title=story_dict.get("title", story_dict["content_key"]),
                summary=story_dict.get("summary", ""),
                source_type=story_dict.get("source_type", "wikipedia"),
                source_ref=story_dict.get("source_ref", story_dict.get("source", "")),
                teams=story_dict.get("teams", []),
                players=story_dict.get("players", []),
                venue=story_dict.get("venue"),
                year=story_dict.get("year"),
                match_format=story_dict.get("match_format"),
                tags=story_dict.get("tags", []),
                is_published=story_dict.get("is_published", True),
                event_month_day=story_dict.get("event_month_day"),
            )
        raise HTTPException(status_code=404, detail="Story not found")
    return _row_to_story(r)
