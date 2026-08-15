"""Tests for deduplication engine."""

from bot.dedup import check_duplicate, enrich_story, generate_canonical_key, text_similarity


def test_text_similarity_identical_and_different():
    assert text_similarity("Kapil Dev 175* Tunbridge Wells", "Kapil Dev 175* Tunbridge Wells") == 1.0
    sim = text_similarity(
        "Sachin Tendulkar 143 Desert Storm in Sharjah vs Australia",
        "Sachin's 143 in Sharjah against Australia during Desert storm",
    )
    assert sim > 0.65

    diff_sim = text_similarity(
        "Virat Kohli 82* vs Pakistan at MCG",
        "Jim Laker 19 wickets at Old Trafford Ashes 1956",
    )
    assert diff_sim < 0.20


def test_generate_canonical_key():
    entry = {
        "category": "story",
        "year": 1998,
        "teams": ["India", "Australia"],
        "players": ["Sachin Tendulkar"],
        "title": "Desert Storm",
    }
    key = generate_canonical_key(entry)
    assert key.startswith("story:1998:india-vs-austra:sachin-tendulkar")


def test_check_duplicate_catches_exact_and_fuzzy():
    existing = [
        {
            "content_key": "story:sharjah-1998-desert-storm",
            "title": "The Desert Storm: Sachin vs Australia (1998)",
            "summary": "Sachin Tendulkar's 143 in Sharjah amidst a literal desert sandstorm.",
            "segments": ["Sachin blasted 143 against Australia in Sharjah."],
            "year": 1998,
            "teams": ["India", "Australia"],
            "players": ["Sachin Tendulkar"],
        }
    ]

    # Exact key match
    dup1, match1, score1, reason1 = check_duplicate(
        {"content_key": "story:sharjah-1998-desert-storm", "title": "Anything"},
        existing,
    )
    assert dup1 is True
    assert reason1 == "exact_content_key"

    # Fuzzy match on title/summary and entities
    candidate_fuzzy = {
        "content_key": "lore:sachin-sharjah-1998",
        "title": "The Desert Storm: Sachin vs Australia (1998)",
        "summary": "Sachin Tendulkar 143 in Sharjah desert sandstorm.",
        "year": 1998,
        "teams": ["India", "Australia"],
        "players": ["Sachin Tendulkar"],
    }
    dup2, match2, score2, reason2 = check_duplicate(candidate_fuzzy, existing)
    assert dup2 is True
    assert score2 >= 0.70

    # Novel unique story
    candidate_novel = {
        "content_key": "story:rinku-singh-5-sixes",
        "title": "Rinku Singh 5 Sixes in 20th Over",
        "summary": "Rinku Singh hit 5 sixes against GT in Ahmedabad.",
        "year": 2023,
        "teams": ["KKR", "GT"],
        "players": ["Rinku Singh"],
    }
    dup3, _, _, reason3 = check_duplicate(candidate_novel, existing)
    assert dup3 is False
    assert reason3 == "unique"


def test_enrich_story():
    existing = {
        "content_key": "story:1",
        "title": "Eden Gardens 2001",
        "teams": ["India"],
        "players": ["VVS Laxman"],
        "tags": ["miracle"],
        "event_month_day": None,
    }
    candidate = {
        "teams": ["Australia"],
        "players": ["Rahul Dravid"],
        "tags": ["comeback"],
        "event_month_day": "03-14",
    }
    enriched = enrich_story(existing, candidate)
    assert "Australia" in enriched["teams"]
    assert "Rahul Dravid" in enriched["players"]
    assert "comeback" in enriched["tags"]
    assert enriched["event_month_day"] == "03-14"
