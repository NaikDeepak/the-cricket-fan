"""Cricsheet Match Anomaly Harvester.

Scans local Cricsheet match datasets to extract nail-biting finishes,
dramatic final overs, and statistical turnarounds.
"""

import logging
from pathlib import Path
from typing import Any

from bot.scripts.harvest_cricsheet_thrillers import scan_cricsheet_match_file

logger = logging.getLogger(__name__)


def harvest_cricsheet_anomalies(data_dir: Path | None = None) -> list[dict[str, Any]]:
    """Scan all Cricsheet JSON files in data_dir and return thriller stories."""
    if data_dir is None:
        data_dir = Path(__file__).resolve().parent.parent / "data" / "cricsheet"

    if not data_dir.exists():
        logger.info("Cricsheet data dir %s not found; returning empty", data_dir)
        return []

    stories = []
    for f in data_dir.glob("*.json"):
        story = scan_cricsheet_match_file(f)
        if story:
            story["source_type"] = "cricsheet"
            story["source_ref"] = f"cricsheet:{f.stem}"
            stories.append(story)

    return stories
