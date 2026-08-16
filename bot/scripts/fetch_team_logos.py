"""Fetch official team logos from Wikipedia / Wikimedia Commons API and sync to DB and local assets.

Usage:
    python -m bot.scripts.fetch_team_logos
"""

import json
import logging
import re
import ssl
import urllib.parse
import urllib.request
from pathlib import Path

import sqlalchemy as sa
from bot.db import get_engine, teams
from composer.config import get_settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# SSL Context configuration
_ssl_ctx = ssl.create_default_context()
try:
    import certifi

    _ssl_ctx.load_verify_locations(cafile=certifi.where())
except Exception:
    _ssl_ctx.check_hostname = False
    _ssl_ctx.verify_mode = ssl.CERT_NONE

HEADERS = {
    "User-Agent": "TheCricketFan/1.0 (https://the-cricket-fan.vercel.app; contact@thecricketfan.app)"
}

LOCAL_LOGOS_DIR = Path(__file__).resolve().parent.parent.parent / "frontend" / "public" / "images" / "logos"

# Custom Wikipedia search mappings for ambiguous / specific team names
WIKI_TITLE_OVERRIDE: dict[str, str] = {
    "Mumbai Indians": "Mumbai Indians",
    "Chennai Super Kings": "Chennai Super Kings",
    "Royal Challengers Bangalore": "Royal Challengers Bengaluru",
    "Royal Challengers Bengaluru": "Royal Challengers Bengaluru",
    "Kolkata Knight Riders": "Kolkata Knight Riders",
    "Delhi Capitals": "Delhi Capitals",
    "Punjab Kings": "Punjab Kings",
    "Rajasthan Royals": "Rajasthan Royals",
    "Sunrisers Hyderabad": "Sunrisers Hyderabad",
    "Gujarat Titans": "Gujarat Titans",
    "Lucknow Super Giants": "Lucknow Super Giants",
    # Women's teams (share crest with main franchise or have WPL/WBBL page)
    "Delhi Capitals Women": "Delhi Capitals (WPL)",
    "Mumbai Indians Women": "Mumbai Indians (WPL)",
    "Royal Challengers Bengaluru Women": "Royal Challengers Bengaluru (WPL)",
    "Gujarat Giants": "Gujarat Giants (cricket)",
    "UP Warriorz": "UP Warriorz",
    # The Hundred
    "Trent Rockets": "Trent Rockets",
    "Trent Rockets Men": "Trent Rockets",
    "Trent Rockets Women": "Trent Rockets",
    "Manchester Originals": "Manchester Originals",
    "Manchester Originals Men": "Manchester Originals",
    "Manchester Originals Women": "Manchester Originals",
    "London Spirit": "London Spirit (cricket team)",
    "London Spirit Men": "London Spirit (cricket team)",
    "London Spirit Women": "London Spirit (cricket team)",
    "Oval Invincibles": "Oval Invincibles",
    "Oval Invincibles Men": "Oval Invincibles",
    "Oval Invincibles Women": "Oval Invincibles",
    "Southern Brave": "Southern Brave",
    "Southern Brave Men": "Southern Brave",
    "Southern Brave Women": "Southern Brave",
    "Welsh Fire": "Welsh Fire",
    "Welsh Fire Men": "Welsh Fire",
    "Welsh Fire Women": "Welsh Fire",
    "Northern Superchargers": "Northern Superchargers",
    "Northern Superchargers Men": "Northern Superchargers",
    "Northern Superchargers Women": "Northern Superchargers",
    "Birmingham Phoenix": "Birmingham Phoenix",
    "Birmingham Phoenix Men": "Birmingham Phoenix",
    "Birmingham Phoenix Women": "Birmingham Phoenix",
    # BBL / WBBL
    "Adelaide Strikers": "Adelaide Strikers",
    "Adelaide Strikers Women": "Adelaide Strikers (WBBL)",
    "Brisbane Heat": "Brisbane Heat",
    "Brisbane Heat Women": "Brisbane Heat (WBBL)",
    "Hobart Hurricanes": "Hobart Hurricanes",
    "Hobart Hurricanes Women": "Hobart Hurricanes (WBBL)",
    "Melbourne Renegades": "Melbourne Renegades",
    "Melbourne Renegades Women": "Melbourne Renegades (WBBL)",
    "Melbourne Stars": "Melbourne Stars",
    "Melbourne Stars Women": "Melbourne Stars (WBBL)",
    "Perth Scorchers": "Perth Scorchers",
    "Perth Scorchers Women": "Perth Scorchers (WBBL)",
    "Sydney Sixers": "Sydney Sixers",
    "Sydney Sixers Women": "Sydney Sixers (WBBL)",
    "Sydney Thunder": "Sydney Thunder",
    "Sydney Thunder Women": "Sydney Thunder (WBBL)",
    # International
    "India": "India men's national cricket team",
    "India Women": "India women's national cricket team",
    "Australia": "Australia men's national cricket team",
    "Australia Women": "Australia women's national cricket team",
    "England": "England cricket team",
    "England Women": "England women's national cricket team",
    "South Africa": "South Africa national cricket team",
    "South Africa Women": "South Africa women's national cricket team",
    "New Zealand": "New Zealand national cricket team",
    "New Zealand Women": "New Zealand women's national cricket team",
    "Pakistan": "Pakistan national cricket team",
    "Pakistan Women": "Pakistan women's national cricket team",
    "West Indies": "West Indies cricket team",
    "West Indies Women": "West Indies women's cricket team",
    "Sri Lanka": "Sri Lanka national cricket team",
    "Sri Lanka Women": "Sri Lanka women's national cricket team",
}


def slugify_team_name(name: str) -> str:
    """Produce clean lowercase snake-case slug for filename (e.g. 'trent_rockets')."""
    s = name.lower()
    s = re.sub(r"[\(\)]", "", s)
    s = re.sub(r"[^\w\s-]", "", s).strip()
    return re.sub(r"[-\s]+", "_", s)


def fetch_wiki_logo(team_name: str) -> str | None:
    """Fetch high-res team logo image URL from Wikipedia REST/Action API."""
    candidates = []
    if team_name in WIKI_TITLE_OVERRIDE:
        candidates.append(WIKI_TITLE_OVERRIDE[team_name])

    # Add fallback title variations
    candidates.append(team_name)
    clean_name = re.sub(r"\s+(Women|Men)$", "", team_name)
    if clean_name != team_name:
        candidates.append(clean_name)
    candidates.append(f"{team_name} (cricket team)")
    candidates.append(f"{clean_name} (cricket team)")

    for title in candidates:
        try:
            # 1. Try Wikipedia summary API (returns official lead image/infobox crest)
            sum_url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{urllib.parse.quote(title)}"
            req = urllib.request.Request(sum_url, headers=HEADERS)
            with urllib.request.urlopen(req, context=_ssl_ctx, timeout=6) as resp:
                data = json.loads(resp.read().decode())
                orig = data.get("originalimage", {}).get("source")
                thumb = data.get("thumbnail", {}).get("source")
                if orig:
                    return orig
                if thumb:
                    return re.sub(r"/\d+px-", "/500px-", thumb)
        except Exception:
            continue

    # 2. Try Wikipedia OpenSearch fallback
    try:
        search_url = f"https://en.wikipedia.org/w/api.php?action=opensearch&search={urllib.parse.quote(team_name + ' cricket')}&limit=1&namespace=0&format=json"
        req = urllib.request.Request(search_url, headers=HEADERS)
        with urllib.request.urlopen(req, context=_ssl_ctx, timeout=6) as resp:
            sdata = json.loads(resp.read().decode())
        if len(sdata) > 1 and len(sdata[1]) > 0:
            found_title = sdata[1][0]
            sum_url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{urllib.parse.quote(found_title)}"
            req2 = urllib.request.Request(sum_url, headers=HEADERS)
            with urllib.request.urlopen(req2, context=_ssl_ctx, timeout=6) as resp2:
                data = json.loads(resp2.read().decode())
                orig = data.get("originalimage", {}).get("source")
                thumb = data.get("thumbnail", {}).get("source")
                if orig:
                    return orig
                if thumb:
                    return re.sub(r"/\d+px-", "/500px-", thumb)
    except Exception as e:
        logger.debug("Search fallback failed for %s: %s", team_name, e)

    return None


def download_image(url: str, dest_path: Path) -> bool:
    """Download image from URL to local file path."""
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, context=_ssl_ctx, timeout=10) as resp:
            data = resp.read()
            dest_path.parent.mkdir(parents=True, exist_ok=True)
            dest_path.write_bytes(data)
            return True
    except Exception as e:
        logger.warning("Failed to download image from %s: %s", url, e)
        return False


def run_sync() -> None:
    """Iterate over all teams in DB, query Wikipedia for logos, download and update logo_url."""
    LOCAL_LOGOS_DIR.mkdir(parents=True, exist_ok=True)
    engine = get_engine(get_settings().database_url)

    with engine.connect() as conn:
        all_teams = conn.execute(sa.select(teams.c.id, teams.c.name, teams.c.logo_url)).all()
        logger.info("Found %d teams in database to inspect for logos", len(all_teams))

        updated_count = 0
        downloaded_count = 0

        for t in all_teams:
            team_id, team_name, current_logo = t[0], t[1], t[2]
            slug = slugify_team_name(team_name)
            local_png = LOCAL_LOGOS_DIR / f"{slug}.png"

            logo_url = fetch_wiki_logo(team_name)
            if not logo_url and current_logo:
                logo_url = current_logo

            if logo_url:
                # Save locally if not exists
                if not local_png.exists():
                    ok = download_image(logo_url, local_png)
                    if ok:
                        downloaded_count += 1
                        logger.info("Downloaded logo for %s -> %s", team_name, local_png.name)

                # Set relative local path or CDN url
                relative_path = f"/images/logos/{slug}.png" if local_png.exists() else logo_url
                conn.execute(
                    teams.update().where(teams.c.id == team_id).values(logo_url=relative_path)
                )
                updated_count += 1
                logger.info("Updated %s with logo: %s", team_name, relative_path)
            else:
                logger.warning("No logo found for %s", team_name)

        conn.commit()
        logger.info(
            "Sync complete! %d teams updated, %d new local logo assets saved.",
            updated_count,
            downloaded_count,
        )


if __name__ == "__main__":
    run_sync()
