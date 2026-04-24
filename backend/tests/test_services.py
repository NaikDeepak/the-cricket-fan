import pytest
from unittest.mock import AsyncMock, MagicMock, patch


@pytest.mark.asyncio
async def test_story_service_returns_required_fields():
    from app.services.story_service import generate_story

    mock_stats = {
        "team_a": {"name": "Mumbai Indians", "short_name": "MI", "color": "#004BA0"},
        "team_b": {"name": "Chennai Super Kings", "short_name": "CSK", "color": "#FFCB05"},
        "venue": "Wankhede Stadium",
        "match_time": "7:30 PM",
        "shock_stat_value": 0,
        "shock_stat_label": "ROHIT 50+ VS CSK (L10)",
        "mi_win_pct": 78,
        "jadeja_dismissals": 5,
    }

    mock_parsed = MagicMock()
    mock_parsed.model_dump.return_value = {
        "headline": "ROHIT HASN'T SCORED >30 vs CSK IN 6 MATCHES.",
        "shock_stat": {
            "value": "0",
            "label": "ROHIT 50+ VS CSK (L10)",
            "one_liner": "0. In 10 matches. Tonight changes that.",
        },
    }
    mock_response = MagicMock()
    mock_response.parsed = mock_parsed

    with patch(
        "app.services.story_service.gemini_client.aio.models.generate_content",
        new_callable=AsyncMock,
        return_value=mock_response,
    ):
        result = await generate_story(mock_stats)

    assert "headline" in result
    assert "shock_stat" in result
    assert "value" in result["shock_stat"]
    assert "label" in result["shock_stat"]
    assert "one_liner" in result["shock_stat"]


@pytest.mark.asyncio
async def test_trivia_service_returns_required_fields():
    from app.services.trivia_service import generate_trivia

    mock_parsed = MagicMock()
    mock_parsed.model_dump.return_value = {
        "question": "HOW MANY TIMES HAS DHONI FINISHED A CHASE IN THE LAST OVER AT WANKHEDE",
        "options": ["3", "7", "11", "2"],
        "correct_index": 2,
        "emphasis": "ZERO FAILURES.",
        "fact": "11. Every single time. Dhoni has never lost a chase at Wankhede in the last 2 overs.",
    }
    mock_response = MagicMock()
    mock_response.parsed = mock_parsed

    with patch(
        "app.services.trivia_service.gemini_client.aio.models.generate_content",
        new_callable=AsyncMock,
        return_value=mock_response,
    ):
        result = await generate_trivia("Wankhede Stadium", "CSK", "MI")

    assert "question" in result
    assert len(result["options"]) == 4
    assert "correct_index" in result
    assert "emphasis" in result
    assert "fact" in result


@pytest.mark.asyncio
async def test_prediction_returns_exactly_3_evidence_items():
    from app.services.prediction_service import calculate_prediction

    stats = {
        "team_a_short": "MI",
        "team_b_short": "CSK",
        "venue": "Wankhede Stadium",
        "mi_chase_win_pct": 80,
        "csk_chase_win_pct": 37,
        "mi_death_economy": 7.2,
        "csk_death_economy": 8.9,
        "csk_vs_spin_avg": 18,
        "mi_vs_spin_avg": 34,
    }

    result = calculate_prediction(stats)
    assert "team" in result
    assert "probability" in result
    assert 0 <= result["probability"] <= 100
    assert len(result["evidence"]) == 3
    for item in result["evidence"]:
        assert "label" in item
        assert "detail" in item
