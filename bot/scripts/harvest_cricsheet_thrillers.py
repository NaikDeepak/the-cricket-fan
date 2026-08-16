"""Algorithmic harvester scanning Cricsheet ball-by-ball datasets for extreme finishes and statistical anomalies."""

import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def scan_cricsheet_match_file(file_path: Path) -> dict | None:
    """Extract match turning points (last over thrillers, comebacks) from Cricsheet JSON file."""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        info = data.get("info", {})
        innings = data.get("innings", [])
        if len(innings) < 2:
            return None

        outcome = info.get("outcome", {})
        winner = outcome.get("winner")
        if not winner:
            return None

        teams = info.get("teams", [])
        venue = info.get("venue", "Unknown Venue")
        dates = info.get("dates", ["Unknown Date"])
        year = int(dates[0].split("-")[0]) if dates and "-" in dates[0] else 2020

        # Check last over finish in 2nd innings
        second_inn = innings[1]
        overs = second_inn.get("overs", [])
        if overs:
            last_over = overs[-1]
            last_over_num = last_over.get("over", 0)
            deliveries = last_over.get("deliveries", [])
            runs_in_last_over = sum(
                d.get("runs", {}).get("total", 0) for d in deliveries
            )

            # If last over had 12+ runs and match was won by chasing team on last over
            if runs_in_last_over >= 12 and winner == teams[1]:
                match_id = file_path.stem
                key = f"story:cricsheet-{match_id}"
                title = f"Last-Over Finish: {teams[1]} vs {teams[0]} ({year})"
                summary = f"{teams[1]} scored {runs_in_last_over} runs in the final over at {venue} to pull off a dramatic win."
                return {
                    "content_key": key,
                    "title": title,
                    "summary": summary,
                    "category": "story",
                    "format": "single",
                    "teams": teams,
                    "players": [],
                    "venue": venue,
                    "year": year,
                    "match_format": info.get("match_type", "T20"),
                    "tags": ["last_over", "thriller", "cricsheet"],
                    "source": f"cricsheet:{match_id}",
                    "segments": [
                        f"🏏 Last-Over Drama ({year}): {teams[1]} needed a heroic final over to beat {teams[0]} at {venue}, hitting {runs_in_last_over} runs in over {last_over_num + 1}! #Cricket #TheCricketFan"
                    ],
                }
    except Exception as e:
        logger.debug("Failed to scan Cricsheet match file %s: %s", file_path, e)
    return None
