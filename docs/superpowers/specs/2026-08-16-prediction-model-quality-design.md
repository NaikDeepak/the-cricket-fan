# Prediction model quality — design

**Status:** approved for planning (2026-08-16)
**Owner:** Deepak Naik
**Related:** `docs/prediction-accuracy-by-league-season.md` (raw data + two
correction notes this design is built on), `docs/superpowers/specs/2026-07-19-prediction-bot-design.md`
(original bot design — the "ship Elo instead of the model if it doesn't
beat baselines" principle this spec extends per-league)

## Origin

User noticed IPL backtest accuracy was 80s pre-2023, dropped to 50s-60s in
2025/2026, and asked whether it was an ingestion problem. It wasn't (data
completeness checked, clean). Two hypotheses were investigated in depth;
one collapsed under scrutiny, one held up. This spec is the result.

## Headline finding

**The model's real out-of-sample edge over Elo is roughly zero, and the
gate that's supposed to catch that cannot see it.**

Trained a date-relative rolling-split model (`train_end = latest_date -
4mo`, sigmoid calibration) and isolated the 6 of 28 leagues whose most
recent season falls **entirely** after that cutoff — genuinely never seen
in training, not just "recent":

| League | Season | N | Model % | Elo % |
|---|---|---:|---:|---:|
| LPL | 2026 | 21 | 43 | 62 |
| MLC | 2026 | 34 | 50 | 56 |
| T20 Blast | 2026 | 113 | 56 | 59 |
| The Hundred | 2026 | 23 | 43 | 48 |
| The Hundred Women | 2026 | 21 | 43 | 57 |
| Women's T20 Blast | 2026 | 48 | 54 | 58 |

Model loses to Elo on accuracy in **all six**. Pooled global test (n=404):
model 57.7% vs Elo 61.4% accuracy; log-loss 0.654 vs 0.661 — a 0.007-nat
edge, smaller than the swing produced by switching calibration method
alone. The committed model's own `gate_passed: true` (log-loss 0.609 vs
Elo 0.642 on the 2026 holdout) looks better only because that holdout is
one global test set dominated by leagues (T20I, WT20I, T20 Blast) where
the model is at or above Elo — small leagues can't move the aggregate
enough to fail it even when they're badly behind.

This is the fact everything below is sequenced around.

## What was investigated and ruled out

**Hypothesis: squad turnover (mega-auction roster disruption) explains
the 2025/2026 drop, concentrated in franchise-auction leagues.**

Retracted. The original evidence (`docs/prediction-accuracy-by-league-season.md`'s
first version) compared **in-sample** pre-2025 accuracy (committed model
trains on years ≤2024) against **out-of-sample** 2025/2026 accuracy, per
league — a confound. Leagues with the deepest match history (IPL, PSL,
BBL, CPL) showed the biggest apparent "drop" mostly because they had the
most data to memorize in-sample, not necessarily because of roster
churn. A controlled test (within-season demeaned correlation between a
computed turnover metric and per-match backtest correctness, n=126 IPL
team-seasons) came back null: r=-0.056, p=0.54. Direct counterexample:
IPL 2026 has *lower* measured turnover than 2025 (0.26 vs 0.57) but
*worse* model accuracy (53% vs 60%).

The turnover *metric itself* has real face validity — computed
appearance-weighted roster overlap from raw Cricsheet `info.players` data
cleanly separates all five known IPL mega-auction seasons (2011/2014/
2018/2022/2025, ≈0.53-0.62) from non-mega seasons (≈0.23-0.34), no
external auction data needed. It measures what it's supposed to measure.
It just doesn't explain the accuracy problem, on the evidence gathered so
far. Kept as an appendix (below) for a future revisit, not built now.

**Hypothesis: the rolling-split fix recovers the franchise-league drop.**

Also not supported, on closer inspection. An earlier partial check (5
hand-picked league-seasons) showed BBL jumping 40%→77%, WPL 45%→73% under
a rolling-split retrain — but those seasons (BBL 2025/26, WPL 2025/26,
also IPL 2025 at 87%, PSL 2025 at 88%) sit **before** `train_end =
2026-04-06` under that rolling scheme, i.e. they're in-sample for that
model, not a real held-out result. The honest 6-league blind test above
supersedes those numbers. **Structural finding, not yet solved**: only 6
of 28 leagues had a season entirely past a single global rolling cutoff.
Franchise leagues run ~2-month annual bursts; a global date either
bisects a season (partial leakage into training) or swallows it whole
(zero held-out signal for that league at all). A single global
`train_end` cannot produce an honest per-league held-out read for exactly
the leagues (IPL/PSL/BBL/CPL/SA20/WPL) this investigation started with.
Flagged as an open problem for a future design pass (per-league,
season-boundary-aware cutoffs are one direction) — not solved in this
spec.

## What was investigated and confirmed

**The calendar-year-relative train/val/test split neutralizes the
existing weekly retrain cron.** `bot/train.py`'s split (`tr = years <=
max_year-2`, computed on calendar year across all 28 leagues merged) means
a model retrained every Monday (`.github/workflows/bot-retrain.yml`, already
running) produces an *identical* split from Jan through Dec — the model
learns nothing new all year, then the whole prior year drops into training
at once on Jan 1. This is real and measurable, but per the section above,
its *value once fixed* is unmeasured — not "recovers accuracy," just "the
retrain automation that already exists starts actually doing something."

**Two production data-integrity bugs, unrelated to the modeling question
— already fixed, ship of record here for completeness:**
- `bot/scripts/ingest_all_leagues.py` computed the delete-scope from the
  full static configured league list, not the leagues that actually
  parsed successfully — a failed download/parse for any single league
  silently deleted that league's existing rows with nothing to replace
  them. Fixed: delete-scope now derived from leagues that actually
  produced rows.
- `bot/scripts/seed_womens_data.py` inserted ~14 hand-fabricated
  "representative" match rows (invented runs/overs/pp/death stats) into
  `team_matches` — the model's training table — guarded only by a
  row-count check. A sibling script's docstring confirms this already
  caused one cleanup incident. Removed; real Cricsheet-derived data for
  those leagues is ingested by `bot/scripts/ingest_real_womens_cricsheet.py`.

**Four independent, inconsistent writers to `team_matches`**, surfaced by
the data-modeller research: `bot/ingest.py` (the sanctioned, cron-driven
path), `bot/scripts/ingest_all_leagues.py`, `bot/scripts/ingest_real_womens_cricsheet.py`,
and `bot/scripts/seed_womens_data.py` (now match-row-free). The first two
derive Cricsheet match identity differently (`ipl_335982` vs `335982` for
the same match) — meaning any future dedup/upsert key needs to be
standardized in exactly one place, or dedup silently fails across writers.

## Design — sequencing

Five changes, ordered by evidence strength, each independently shippable
("slowly move forward" per the user's brief — not a big-bang rewrite).

### 1. Per-league gate + Elo-fallback routing

**Why first:** the only change here directly justified by hard evidence
(6/6 blind-test losses invisible to the current gate), and it becomes the
instrument every later change gets measured through.

- Add a per-league check (log-loss + Brier vs Elo — not accuracy; n≈20-40
  per league-season is too noisy for a raw accuracy gate) alongside the
  existing global gate in `bot/train.py`'s `train_and_evaluate`.
- Trailing window wider than the global 2-month test window — a scan of
  per-league match volume found only 9 of 28 leagues clear 15 matches in
  any 3-month window. Use a trailing 12-month window (or "last ~40
  matches per league") for the per-league check specifically.
- Minimum-n floor (~30 matches): leagues below it are *reported* in
  `metrics.json` for visibility but don't gate — not enough signal to
  trust a pass/fail at n=13.
- On per-league failure: don't block the whole retrain. Ship the new
  global artifact, but route that specific league's live predictions
  through Elo instead of the model until it recovers — same principle
  the original bot design spec already states globally ("ship Elo
  instead — honesty over hype"), applied per-league. Record which
  leagues are Elo-routed in `metrics.json` so it's auditable; this
  matters because the product's whole premise is a public accuracy
  track record.
- `composer/routers/predictions.py` needs to consult the override list at
  serving time.

**Known limitation (as of merge):** `run_model`'s override routing is
implemented and correct, but `fixtures.league` (populated from CricAPI's
raw `series` field via `bot/fixtures_provider.py::_resolve_league`) does
not currently match the canonical league labels used in
`league_elo_override` (populated from the Cricsheet ingest league map in
`bot/scripts/ingest_all_leagues.py`) for most leagues — e.g. CricAPI's
`"Indian Premier League"` vs. the canonical `"IPL"`. Confirmed via
`bot/tests/data/provider_matches.json`'s fixture data. As a result, the
override routing is currently a safe no-op against real production
fixtures (it always falls through to the model path) until this
namespace is resolved — most likely via an alias table in
`bot/fixtures_provider.py::_resolve_league`, keyed off the same
canonical labels `bot/scripts/ingest_all_leagues.py`'s `LEAGUES` list
already defines. The routing also does not yet cover 3 other places the
model is called for live predictions (`bot/run.py::tick`, the
GH-Actions X-posting cron; `composer/routers/generate.py`'s
`/generate/bot`; `composer/routers/live_predict.py`) — only
`composer/routers/predictions.py::run_model` consults the override
list. This branch adds observability (see `run_model`'s logging) so this
gap is visible in production logs on the first retrain that populates
`league_elo_override`, rather than failing silently. Both items are
tracked as follow-up work, not fixed in this merge, because a correct
fix for the first needs real CricAPI response samples not available at
the time of this review.

### 2. Split fix + sigmoid calibration (atomic)

**Why second, and why "atomic":** ships behind gate #1 so its actual
effect (currently unmeasured, not assumed positive) gets caught if it's
bad for any specific league. Must be one change, not two — isotonic
regression hard-fails (`SystemExit` via `gate_passed`) under the smaller
validation window a rolling scheme requires (empirically confirmed:
isotonic gives model log-loss 0.664 > Elo 0.661 → gate fails; sigmoid
gives 0.654 < 0.661 → passes). Landing the split change alone would start
hard-failing the weekly cron.

- Replace `years = _year(meta["date"]); tr = years <= max_year-2` with a
  date-relative window anchored to the latest ingested match date:
  `train_end = latest_date - 4 months`, `val_end = train_end + 2 months`,
  `test = (val_end, latest_date]`.
- Keep one global model (not per-league) — most leagues are too
  sample-size-starved (WCPL 24 matches total, FairBreak 38) for a stable
  per-league split.
- Swap `IsotonicRegression` for `sklearn.linear_model.LogisticRegression`
  (Platt scaling) behind a small wrapper matching the existing
  `.predict(raw) -> calibrated` interface `bot/backtest.py` and
  `bot/predict.py` already call.
- Add a guard: skip training (exit 0, no commit) if `n_train` hasn't
  grown since the last run, so a week with zero new Cricsheet data
  doesn't burn CI minutes on an identical artifact.
- Update `bot/README.md` and `docs/superpowers/specs/2026-07-19-prediction-bot-design.md`'s
  stale cadence note — the workflow already runs weekly; the docs
  describe a manual/monthly process that isn't what's live.

### 3. `league` as a categorical feature + Elo as a direct model input

**Why:** cheap, low-risk, plausible value independent of everything else
— currently `build_features` receives no league identifier at all, so
the model has no way to condition on competition context (a Hundred
match's run-rate baseline isn't a T20I's). Elo is computed for every
match already (used only as the external baseline) but never handed to
the model as a feature — a near-free continuous strength prior.

- Thread a `league` parameter through `build_features`, feed it to
  LightGBM as a native categorical column (`category` dtype, not
  one-hot — cheap given `num_leaves=15`).
- Add `elo.expect(team_a, team_b)` as a new feature.
- Watch small-league log-loss in the first post-change `metrics.json` —
  the signature of overfit league×feature interaction splits on thin
  data; fallback is a coarser "format family" categorical if it shows up.

### 4. `match_id` + idempotent upsert ingestion + artifact versioning

**Why:** real, independent wins — unlocks true "ingest just this year"
incremental workflows (the user's explicit ask) and cheap rollback,
regardless of how 1-3 land.

- **`match_id`**: Cricsheet's own numeric filename stem, threaded as a
  **required** field on `TeamMatchRow`/`parse_match_dict` (not
  dict-injected after the fact — `ingest_all_leagues.py` calls
  `parse_match_dict` directly, bypassing any wrapper that would miss).
  Standardize the derivation convention in exactly one place
  (`bot/cricsheet.py`) — today `bot/ingest.py`'s pre-renamed files
  produce `ipl_335982`, `ingest_all_leagues.py`'s raw zip members
  produce `335982` for the same match; pick one and make every writer
  go through it.
- **Schema**: nullable `match_id` column + `UNIQUE(match_id, team)` index
  on `team_matches` (nullable so it can be added via plain `ALTER TABLE`
  against the existing 26,972 rows without failing; SQLite/Postgres both
  treat NULL as distinct under a unique index, so it's safe pre-backfill).
- **One-time migration**: run today's full-archive `bot/ingest.py` once
  more, unchanged in spirit, now populating `match_id` on every row as it
  goes. Last legitimate full wipe+reinsert — `team_matches` stops being a
  disposable rebuildable cache from this point on.
- **`upsert_matches()` helper**: `DELETE WHERE match_id IN (batch)` then
  bulk insert, used by all future ingest. Gives idempotent re-ingest of
  the same file, self-correcting behavior on a republished/corrected
  file, and scoping — pointing `--cricsheet-dir` at just one new season's
  files only touches that season's `match_id`s.
- **Keep the existing weekly full-archive cron as-is** (now a full
  reconcile pass under `upsert_matches`, since it delete+reinserts every
  match_id it sees regardless of change) — cheap insurance against the
  unverified assumption that Cricsheet's numeric id is stable across a
  republished/corrected file. Incremental single-year ingest is a new
  *additional* capability, not a replacement for this safety net.
- **Consolidate writers**: fix or delete `bot/scripts/ingest_all_leagues.py`
  and `bot/scripts/ingest_real_womens_cricsheet.py` now that `league_map.json`
  + the GH Actions workflow cover all 28 leagues through the sanctioned
  path — decision for implementation time, default to delete unless
  something in the workflow still needs them as manual/local fallback.
- **Artifact versioning**: `bot/train.py` writes each retrain to both the
  live pointer path (`bot/artifacts/model.pkl`, unchanged — zero call-site
  changes across the four consumers) and a `bot/artifacts/versions/{date}_{shortsha}/`
  directory. Rollback is `cp` + commit, no code changes. Prune to last ~10
  versions in the retrain workflow if it ever becomes a concern (not
  required to start — 513KB/week is trivial).
- **Interface hygiene**: consolidate the three places that unpack
  `artifact["model"]`/`["calibrator"]`/`["feature_names"]` directly
  (`bot/backtest.py`, `composer/routers/predictions.py`, `bot/predict.py`
  itself) behind `bot/predict.py`'s accessor functions. Treat the
  3-key dict shape as a permanent floor; add fields additively
  (`schema_version`, `league_elo_override` for item 1's routing,
  `trained_at`). **Ordering constraint for any future feature addition**
  (e.g. turnover, if it's ever revisited): `bot/features.py` must ship
  before or in the same change as any artifact trained on a feature it
  adds — an artifact whose `feature_names` includes a key `build_features`
  doesn't compute yet is a `KeyError` in production inference.

### 5. Squad turnover — deferred, speculative

Not built now — no surviving evidence it explains an accuracy gap (see
"ruled out," above). Kept as an appendix for a future revisit, gated
behind: (a) gate #1 actually measuring per-league quality honestly, so a
before/after comparison would mean something, and (b) a specific
franchise-league failure pattern showing up under that honest gate that
turnover is a plausible explanation for — not built speculatively ahead
of that evidence.

## Appendix: squad-turnover metric definition (prior art, not scheduled)

Two components, both operating on Cricsheet's `info.players` (playing XI
per match) + `info.registry.people` (stable player IDs across seasons —
use these, not raw name strings, which drift in spelling):

```
roster(T, S) = set of registry player IDs appearing in T's rows, season S, date < target_date

prior_season_turnover(T, S) =
    NEUTRAL (0.5)  if |roster(T, S_prev2)| < 8
    1 - |roster(T,S_prev) ∩ roster(T,S_prev2)| / |roster(T,S_prev2)|   otherwise
# lagged, always available, no blind spot — but doesn't anticipate the
# upcoming season's own disruption (validated: reads ~0.38 going into
# IPL 2025, the opposite of what 2025 turned out to be)

new_share(T, S, d) =
    prior_season_turnover(T,S)   if zero appearances so far this season
    Σ appearances(p) for p not in roster(T, S_prev) / Σ all appearances so far   otherwise
# in-season realized, appearance-weighted, unbiased from match 1 —
# the metric that actually detects mega-auction seasons cleanly
```

Ingestion prerequisite if ever revisited: a `match_players` table (one row
per match+team, `players_json` TEXT of registry IDs — matches the
codebase's existing `*_json` TEXT convention for SQLite/Postgres
portability), keyed by the `match_id` from item 4 above.

## Non-goals

- Per-league models (sample-size-starved for ~19 of 28 leagues).
- Removing the held-out test entirely in favor of trusting gate history.
- Data-volume or manual-only retrain triggers — the existing weekly cron
  is fine once item 2 stops neutralizing it.
- External auction/retention data source for turnover — would resolve
  the match-1 blind spot completely but adds a second async data
  dependency to an otherwise self-contained Cricsheet-only pipeline;
  worth its own proposal later, not in scope here.
