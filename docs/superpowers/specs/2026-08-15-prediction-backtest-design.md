# Prediction Model Backtest Page — Design Spec

Date: 2026-08-15
Status: Approved by owner, pending implementation plan

## Problem

Owner wants a stock-market-style "backtest" page for the prediction model:
pick a league and a year, run the model against that year's real games, see
predicted vs actual result per game and an overall accuracy %. Composer
today only shows forward-looking accuracy on predictions it already made and
settled (`/composer/predictions`) — there's no way to point the model at an
arbitrary past season and see how it would have done.

The pieces already exist and are leakage-guarded:
- `bot/features.py`'s `build_features` only reads `team_matches` rows
  strictly before the target match date.
- `bot/train.py`'s `train_and_evaluate` already does a version of this at
  training time (temporal holdout year, Elo baseline, home-advantage
  baseline, written to `bot/artifacts/metrics.json`) — but it's fixed to
  whichever year training last held out, not selectable, and not surfaced
  in any UI.
- `team_matches` (cricsheet-ingested) has full per-league, per-season match
  history with `won`/`date`/`season`/`league`/`venue`.
- Composer already loads the committed model artifact at startup
  (`app.state.artifact`) and has a `build_features` → `predict` call
  pattern in `generate.py`, `live_predict.py`, and `run-model`.

This spec adds an on-demand backtest: no retraining, reuses the committed
artifact, reuses the same leakage-guarded feature pipeline, computes
entirely at request time with no new persisted state.

## Approach

Two approaches were considered (full comparison in brainstorming
transcript). **Chosen: live, on-demand backtest by league+season**, over
just surfacing the static `metrics.json` from the last training run —
the static option isn't selectable and only covers one fixed year, which
doesn't match "test against a league's games of that year."

## Design

### Data flow

New `bot/backtest.py` (pure functions, no DB writes, no retraining):

1. **Pairing** — `team_matches` has two rows per match (one per team's
   perspective). Pair them into one row per match, same dedup logic as
   `train.py`'s `build_dataset` (group by `date` + `tuple(sorted([team,
   opponent]))`, resolve `home_team` from whichever row has `home=True`
   before dropping duplicates) — but unlike `build_dataset`, keep
   `league`, `season`, and `venue` on the paired row so results can be
   filtered and displayed. This lives in `backtest.py`, not bolted onto
   `train.py`'s `build_dataset`, so training's contract (and
   `test_train.py`) is untouched.
2. **Filter** — to the requested `league` + `season` (exact string match
   against `team_matches.league` / `.season`, e.g. `"IPL"` / `"2024"`).
3. **Predict per match** — for each filtered match, call
   `build_features(full_df, team_a, team_b, venue, date, home_team)`
   where `full_df` is the *entire* unfiltered `team_matches` table (all
   leagues, all seasons) — this is what makes the leakage guard correct;
   the model needs pre-match history same as at training time, not just
   history from the filtered slice. Then `predict(artifact, feats)` from
   the caller-supplied committed artifact.
4. **Baselines** — replay `bot/elo.py`'s `Elo` chronologically over the
   full paired history (same technique as `train_and_evaluate`), score
   only on the filtered subset for `elo_accuracy_pct`. Also compute
   `home_accuracy_pct` ("always predict the home team", `0.5` prob when
   neither team is home — matches `train.py`'s `home_pred` baseline).
5. **Aggregate** — `total`, `correct`, `accuracy_pct` for the model, plus
   the two baseline percentages, plus the per-game list sorted by date.

No new DB tables. No caching layer for v1 — a season is ~70 matches,
recompute is cheap enough per request (matches the cost profile of
`run-model`, which already does per-fixture feature builds live).

### Endpoints (`composer/routers/predictions.py`)

- `GET /predictions/backtest/options` → distinct league/season pairs
  available from paired `team_matches` history:
  ```json
  {"leagues": ["IPL", "..."], "seasons_by_league": {"IPL": ["2022","2023","2024"]}}
  ```
- `GET /predictions/backtest?league=IPL&season=2024` →
  ```json
  {
    "league": "IPL", "season": "2024",
    "total": 70, "correct": 46, "accuracy_pct": 66,
    "elo_accuracy_pct": 61, "home_accuracy_pct": 53,
    "games": [
      {"date": "2024-03-22", "team_a": "...", "team_b": "...", "venue": "...",
       "prob_team_a": 0.63, "predicted_winner": "...", "actual_winner": "...",
       "correct": true}
    ]
  }
  ```
  Uses `request.app.state.artifact`; `503` with the existing "model
  artifact not loaded" message if unset (same pattern as `generate.py`).
  Unresolvable league/season (0 paired matches) → `200` with `total: 0`,
  empty `games` — not a 404; a real but data-less answer.

New Pydantic schemas in `composer/schemas.py`: `BacktestOptions`,
`BacktestGame`, `BacktestResult`.

### Frontend

New page `/composer/backtest`, added to composer nav alongside
`predictions`/`analytics`. Requirements from owner: select league, select
year, run backtest, show actual vs predicted result per game, plus
whatever supporting UI components the page needs (accuracy stat, baseline
comparison, empty/loading/error states) — **the page's visual design
itself is delegated to the `impeccable` skill at implementation time**,
not fully speced here; component conventions already established in
`predictions/page.tsx` (`Crest`, team theme colors, accuracy ring pattern,
status-pill hit/miss styling) are available for reuse but not mandatory.
This is an explicit override of `CLAUDE.md`'s default
`frontend-design:frontend-design` skill for this one page.

Data layer: extend `composerApi` (`frontend/src/lib/composerApi.ts`) with
`getBacktestOptions()` and `runBacktest(league, season)`, typed against the
schemas above.

### Error / edge handling

| Case | Behavior |
|---|---|
| Artifact not loaded | `503`, page shows honest error state (DESIGN.md Honest-State Rule) |
| League/season with no paired matches | `200`, empty `games`, page shows honest empty state, not a spinner-forever or silent blank |
| `/options` returns no leagues at all (no ingested data) | Page disables the picker with a message, doesn't crash |

### Testing

- `bot/tests/test_backtest.py` — pairing/dedup correctness, league+season
  filtering, per-game correct/incorrect labeling, aggregate accuracy math,
  Elo/home baseline calc — synthetic `team_matches`-shaped fixture, no DB.
- `composer/tests/test_backtest_endpoint.py` — `/options` and
  `/backtest` happy path, `503` when `app.state.artifact` is `None`,
  empty-result path for an unknown league/season.
- Frontend — page test under
  `frontend/src/app/composer/backtest/__tests__/`, following the sibling
  `predictions`/`analytics` test conventions.

## Non-goals

- No retraining, no model changes.
- No persistence of backtest runs (not a history/leaderboard feature —
  YAGNI unless asked for later).
- No cross-league backtest in one run (league is a required filter).
- Not exposed on the public `/stories` surface — composer-internal tool,
  same as `/composer/predictions`.
