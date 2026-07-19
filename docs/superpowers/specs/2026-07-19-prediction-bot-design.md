# The Cricket Fan — X Prediction Bot Design

**Date:** 2026-07-19
**Status:** Approved for planning

## Context & Pivot

The original monetization thesis (fantasy affiliate via Dream11 et al.) is dead: India's
Promotion and Regulation of Online Gaming Act (PROGA) came into force May 1 2026, and the
Supreme Court ruling of May 27 2026 classified money-staked fantasy as betting/gambling.
Real-money fantasy no longer operates in India.

New direction: the product becomes an **automated X (Twitter) account** posting match win
predictions, trivia, and public accuracy tracking for all T20 cricket. It is a content-brand
play: near-zero running cost, audience builds while the web UI is parked, and the ML engine
is strong portfolio material. The existing Next.js UI is **parked** — no UI work in this
phase. The existing FastAPI backend remains untouched except for reuse of its data pipeline.

This spec supersedes the prior "stash smart" UI-rebuild direction; the UI rebuild may return
later if the audience grows.

**Note:** The project CLAUDE.md "no ML" constraint was an MVP-phase rule and is explicitly
overridden by this spec (owner decision, 2026-07-19).

## Product Definition

- **Coverage:** all major T20 leagues (IPL, BBL, PSL, SA20, CPL, The Hundred) + T20
  internationals. Year-round content.
- **Per match, three posts:**
  1. **T-3h prediction:** win probability % + top-3 data reasons.
  2. **T-1h trivia:** one data-driven stat nugget about the matchup/venue.
  3. **Post-result accuracy update:** outcome vs prediction + running season record
     (e.g. "Called it: 64% CSK ✓ — Season 23/31").
- **Volume:** ~240 posts/month at peak; X API free tier allows 500 writes/month.
- **Tone/safety:** statistical content only. No betting language, odds framing, or
  gambling links. Disclaimer lives in the account bio.

## Architecture

```
Cricsheet bulk JSON (all T20 leagues + T20I)
   → parser/aggregator (reuse backend/app/data/) → Neon Postgres (feature store)
   → offline training script → model artifact (model.pkl + metrics.json, committed to repo)

GitHub Actions cron (every 2h):
   fixtures API → upcoming matches
   → feature builder → model.predict_proba → compose posts → X API
   results API → completed matches → accuracy post + prediction log
```

New top-level `bot/` package:

| Module | Responsibility |
|---|---|
| `bot/fixtures_provider.py` | Adapter interface over a free cricket API (fixtures + results). Provider swappable. Owns the entity-resolution alias table mapping API team/venue names to canonical Cricsheet identifiers. |
| `bot/features.py` | Pre-match feature builder from Postgres aggregates. Leakage-guarded. |
| `bot/train.py` | Offline training + backtest; writes `model.pkl` + `metrics.json`. |
| `bot/predict.py` | Load artifact, produce calibrated probability + top-3 SHAP reasons. |
| `bot/compose.py` | Post templates (prediction / trivia / result). ≤280 chars. |
| `bot/poster.py` | X API v2 client (write-only). |
| `bot/run.py` | Cron entrypoint: one idempotent tick. |

Infrastructure: GitHub Actions (cron + manual retrain workflow), Neon free-tier Postgres,
X API v2 free tier. Zero servers, zero monthly cost.

### Entity Resolution (Cricsheet ↔ live API)

Cricsheet team/venue names are free strings and drift over time ("Royal Challengers
Bangalore" → "Royal Challengers Bengaluru", venue spelling variants). The live API will use
its own spellings. `fixtures_provider.py` maintains an alias mapping table (Postgres) that
translates API names to canonical Cricsheet identifiers before the feature builder runs.

**Hard-fail rule:** if a team or venue cannot be resolved, the match is skipped and logged —
the bot must never build features through unresolved entities (silent NaNs → garbage
predictions posted publicly).

### Neon Storage Budget

Neon free tier is 500MB. Postgres holds only tabular aggregates and bot state (predictions,
posts, alias table, rolling feature tables). Raw Cricsheet JSON and ball-by-ball rows never
enter Postgres — the retrain workflow downloads Cricsheet fresh into the Actions runner and
computes aggregates locally, writing only the aggregate tables.

## ML Engine

- **Features (pre-match only):** rolling team form (last 5/10 matches, recency-weighted),
  head-to-head record, venue win/chase bias, rolling batting run-rate and bowling economy
  aggregates, home-ground flag, league identifier. Toss is excluded (unknown at post time).
- **Season-boundary decay:** rolling features apply an explicit extra decay factor across
  season boundaries — T20 franchise squads churn heavily (IPL mega-auctions can replace most
  of a roster), so prior-season form must carry far less weight than current-season form.
- **Ties and no-results:** a super-over (eliminator) winner counts as a 1.0 win — the
  pipeline parses Cricsheet's `outcome.eliminator` field. True ties without eliminator and
  abandoned/no-result matches are excluded from training labels and voided in the accuracy
  record.
- **DLS handling:** innings from DLS-affected matches (`outcome.method` = "D/L") are
  excluded from rolling run-rate/economy aggregates (rain-shortened chases distort rates);
  the match result still counts toward win/loss form.
- **Model:** LightGBM binary classifier with probability calibration (isotonic).
- **Split:** time-based — train ≤2023, validate 2024, test 2025+. No shuffling.
- **Metrics:** accuracy, log-loss, Brier score, calibration curve.
- **Acceptance gate:** model must beat two baselines (Elo rating model, always-home) on the
  held-out test set. If it does not, ship the Elo model instead — honesty over hype.
- **Explainability:** per-prediction top-3 SHAP feature contributions become the human-readable
  "reasons" in the prediction post. No black-box output.
- **Retraining:** manual-trigger GitHub Actions workflow (~monthly): download new Cricsheet
  data, re-aggregate, retrain, commit new artifact with metrics diff.
- **Expectation setting:** T20 pre-match prediction has a realistic ceiling of ~60–65%
  accuracy. The public accuracy log is the trust mechanism, not inflated claims.

## Bot Loop & State

- **`predictions` table:** match id, teams, predicted probability, features snapshot,
  outcome, correct flag, void flag.
- **`posts` table:** unique key `(match_id, post_type)`, state `scheduled → posted | failed`.
- The cron tick is idempotent: re-runs never double-post (unique constraint), failed posts
  retry on subsequent ticks (max 3 attempts, then abandoned with a log entry).
- **Timing (window-based, never exact):** GitHub Actions cron is best-effort and can fire
  late, so all timing is SQL time-window queries against `scheduled` state (e.g.
  `start_time - now() <= interval '3 hours' AND state = 'scheduled'`), never exact-time
  assumptions. Prediction posts in the first tick inside the T-3h window; trivia inside
  T-1h; result post in the first tick after the result is available.
- **Late-tick guard:** a prediction is never posted after the match's scheduled start time —
  if every tick misses the window, the prediction is abandoned (logged), not posted stale.
- **Trivia source:** the existing data-driven trivia path (no LLM cost). Gemini free tier
  optional behind a flag.
- **Quota circuit breaker:** `poster.py` checks the current month's posted count (from the
  `posts` table) before sending. At ≥450 posts, trivia posts are dropped; at ≥490, only
  results post. Priority: prediction > result > trivia. Protects against overlapping
  tournaments blowing the 500/month X free-tier cap.
- **Readable reasons:** `compose.py` owns a translation dictionary mapping SHAP feature
  names to fan-readable phrases (e.g. `rolling_rr_team_a_last_5` → "strong recent batting
  run-rate"). An untranslated feature falls back to a generic phrase and is logged so the
  dictionary gets extended.

## Failure Handling

- Fixtures/results API down → skip tick, log, post nothing. Never post from stale data.
- X post failure → row remains `failed`, retried next tick, abandoned after 3 attempts.
- Match abandoned / no result → prediction marked `void`, excluded from the accuracy record.
- Dry-run mode (`BOT_DRY_RUN=1`) prints composed posts instead of sending — used in CI and
  local development.

## Secrets (GitHub Actions)

`X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET`, `CRICKET_API_KEY`,
`DATABASE_URL` (Neon).

## Testing

1. **Leakage test (critical):** the feature builder, given a match date, must only read rows
   strictly before that date — explicit pytest.
2. Unit tests: template rendering (≤280 chars, formatting), post state-machine transitions,
   void/abandoned handling, fixtures-provider parsing against recorded JSON fixtures,
   entity-resolution hard-fail on unknown names, super-over/DLS parsing, circuit-breaker
   thresholds, late-tick guard.
3. **Backtest gate:** test asserts `metrics.json` shows the model beating both baselines on
   the held-out set.
4. Integration: a full `bot.run` tick in dry-run mode against a seeded DB asserts the right
   posts are generated at the right times.
5. The existing backend pytest suite stays green (backend untouched).

## Out of Scope

- Web UI work (parked), fantasy features, affiliate/ads/monetization integrations,
  live in-match (ball-by-ball) predictions, ODI/Test formats, paid data APIs,
  posting platforms other than X.

## Success Criteria

- Bot runs unattended for a full series: correct pre-match predictions posted, trivia
  posted, results logged, accuracy record accurate, zero duplicate posts.
- Backtested model beats both baselines with calibrated probabilities.
- Total running cost: ₹0/month.
