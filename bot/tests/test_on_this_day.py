"""Tests for the On-This-Day Calendar Engine."""

from bot.harvest.on_this_day import (
    CALENDAR_MILESTONES,
    get_curated_milestone_for_date,
    resolve_on_this_day_story,
)


def test_calendar_milestones_have_required_metadata():
    assert len(CALENDAR_MILESTONES) >= 20
    for m in CALENDAR_MILESTONES:
        assert "event_month_day" in m
        assert "title" in m
        assert "segments" in m
        assert len(m["segments"]) >= 1
        assert len(m["event_month_day"]) == 5


def test_get_curated_milestone_for_date():
    sachin_bday = get_curated_milestone_for_date("04-24")
    assert sachin_bday is not None
    assert "Sachin" in sachin_bday["title"]

    dhoni_bday = get_curated_milestone_for_date("07-07")
    assert dhoni_bday is not None
    assert "Dhoni" in dhoni_bday["title"]


def test_resolve_on_this_day_story_persists_and_retrieves(engine):
    with engine.begin() as conn:
        # 1. Resolve for a curated date (e.g. 04-24 Sachin birthday)
        story1 = resolve_on_this_day_story(conn, "04-24")
        assert "Sachin" in story1["title"]

        # 2. Re-resolve should hit DB
        story2 = resolve_on_this_day_story(conn, "04-24")
        assert story2["content_key"] == story1["content_key"]

        # 3. Resolve for an unmapped date falls back cleanly
        fallback_story = resolve_on_this_day_story(conn, "12-25")
        assert fallback_story is not None
        assert "12-25" in fallback_story["event_month_day"]
