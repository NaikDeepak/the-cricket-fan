"""Standalone trivia facts for days with no upcoming fixture.

Each candidate carries a content_key identifying the underlying fact, so
run.py can exclude facts already posted in the last 30 days (see
db.trivia_log). Two styles, mirroring compose.trivia_post's existing
H2H/venue shape plus a season records/extremes pool.
"""

import random

import pandas as pd

from .compose import _truncate

MIN_H2H_MEETINGS = 3
MIN_VENUE_HOME_MATCHES = 5
MIN_PP_OVERS = 5.0  # powerplay is 6 overs; require most of it faced
MIN_DEATH_OVERS = 4.0  # require a meaningful chunk of death bowling


def _h2h_candidates(df: pd.DataFrame) -> list[tuple[str, str]]:
    if not len(df):
        return []
    counts = df.groupby(["team", "opponent"]).size()
    out: list[tuple[str, str]] = []
    for (team, opponent), n in counts.items():
        if n < MIN_H2H_MEETINGS or team >= opponent:
            continue  # emit one direction per pair; team < opponent sorts the key
        h2h = df[(df["team"] == team) & (df["opponent"] == opponent)]
        wins = int(h2h["won"].sum())
        content_key = f"h2h:{team}:{opponent}"
        text = _truncate(
            f"📊 {team} vs {opponent}: {team} lead {wins}-{len(h2h) - wins} "
            f"in their last {len(h2h)} meetings. #Cricket"
        )
        out.append((content_key, text))
    return out


def _venue_candidates(df: pd.DataFrame) -> list[tuple[str, str]]:
    if not len(df):
        return []
    out: list[tuple[str, str]] = []
    for venue, group in df.groupby("venue"):
        home_rows = group[group["home"]]
        if len(home_rows) < MIN_VENUE_HOME_MATCHES:
            continue
        win_rate = home_rows["won"].mean()
        first = venue.split(",")[0]
        content_key = f"venue:{venue}"
        text = _truncate(
            f"📊 {first}: home teams have won {round(win_rate * 100)}% "
            f"of recent matches here. #Cricket"
        )
        out.append((content_key, text))
    return out


def _record_candidates(df: pd.DataFrame) -> list[tuple[str, str]]:
    if not len(df):
        return []
    latest_season = df["season"].max()
    season_df = df[(df["season"] == latest_season) & (~df["dls"])]
    out: list[tuple[str, str]] = []

    scored = season_df.dropna(subset=["runs_scored", "runs_conceded"])
    if len(scored):
        margins = (scored["runs_scored"] - scored["runs_conceded"]).abs()
        row = scored.loc[margins.idxmax()]
        margin = abs(row["runs_scored"] - row["runs_conceded"])
        content_key = f"record:win_margin:{latest_season}"
        text = _truncate(
            f"📊 Biggest scoring gap this season: {row['team']} "
            f"{round(row['runs_scored'])} vs {row['opponent']} "
            f"{round(row['runs_conceded'])} ({round(margin)}-run gap). #Cricket"
        )
        out.append((content_key, text))

    totals = season_df.dropna(subset=["runs_scored"])
    if len(totals):
        row = totals.loc[totals["runs_scored"].idxmax()]
        content_key = f"record:highest_total:{latest_season}"
        text = _truncate(
            f"📊 Highest total this season: {row['team']} "
            f"{round(row['runs_scored'])} vs {row['opponent']} at "
            f"{row['venue'].split(',')[0]}. #Cricket"
        )
        out.append((content_key, text))

    chases = season_df[~season_df["batted_first"] & season_df["won"]]
    chases = chases.dropna(subset=["runs_scored"])
    if len(chases):
        row = chases.loc[chases["runs_scored"].idxmax()]
        content_key = f"record:best_chase:{latest_season}"
        text = _truncate(
            f"📊 Best chase this season: {row['team']} ran down "
            f"{round(row['runs_scored'])} vs {row['opponent']} at "
            f"{row['venue'].split(',')[0]}. #Cricket"
        )
        out.append((content_key, text))

    pp = season_df.dropna(subset=["pp_runs_scored", "pp_overs_faced"])
    pp = pp[pp["pp_overs_faced"] >= MIN_PP_OVERS]
    if len(pp):
        rate = pp["pp_runs_scored"] / pp["pp_overs_faced"]
        row = pp.loc[rate.idxmax()]
        best_rate = rate.loc[rate.idxmax()]
        content_key = f"record:best_pp_tempo:{latest_season}"
        text = _truncate(
            f"📊 Fastest powerplay this season: {row['team']} at "
            f"{round(best_rate, 1)} runs/over vs {row['opponent']}. #Cricket"
        )
        out.append((content_key, text))

    death = season_df.dropna(subset=["death_runs_conceded", "death_overs_bowled"])
    death = death[death["death_overs_bowled"] >= MIN_DEATH_OVERS]
    if len(death):
        rate = death["death_runs_conceded"] / death["death_overs_bowled"]
        row = death.loc[rate.idxmin()]
        best_rate = rate.loc[rate.idxmin()]
        content_key = f"record:best_death_economy:{latest_season}"
        text = _truncate(
            f"📊 Best death-overs economy this season: {row['team']} conceded "
            f"{round(best_rate, 1)} runs/over vs {row['opponent']}. #Cricket"
        )
        out.append((content_key, text))

    return out


def build_candidates(df: pd.DataFrame) -> list[tuple[str, str]]:
    return _h2h_candidates(df) + _venue_candidates(df) + _record_candidates(df)


def pick_standalone_trivia(
    df: pd.DataFrame, recent_keys: set[str], rng: random.Random | None = None
) -> tuple[str, str] | None:
    rng = rng or random.Random()
    candidates = build_candidates(df)
    if not candidates:
        return None
    pool = [c for c in candidates if c[0] not in recent_keys]
    if not pool:
        pool = candidates  # every candidate excluded -- repeat beats silence
    return rng.choice(pool)
