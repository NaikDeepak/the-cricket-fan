# The Cricket Fan — X Prediction Bot

Automated X account: T20 win predictions (calibrated LightGBM + SHAP reasons),
data-driven trivia, public accuracy record. See
`docs/superpowers/specs/2026-07-19-prediction-bot-design.md`.

## Setup (one-time)

1. Neon free-tier Postgres → set `BOT_DATABASE_URL` (postgresql+psycopg://...).
2. CricAPI key (free tier) → `CRICKET_API_KEY`.
3. X developer app (free tier, OAuth1 user context, write) → 4 X_* secrets.
4. Add all six as GitHub Actions secrets.
5. Run the `bot-retrain` workflow once: fills Neon + commits `bot/artifacts/`.
6. `bot-run` cron then posts automatically. Test first with
   `workflow_dispatch` + `dry_run=1`.

## Local dev

```
pip install -r bot/requirements.txt
python -m pytest bot/tests -v
BOT_DRY_RUN=1 BOT_DATABASE_URL=sqlite:///bot.db python -m bot.run
```

## Ship gate

`bot/artifacts/metrics.json` → `gate_passed` must be true (model beats Elo on
held-out log-loss + Brier). `python -m bot.train` exits non-zero otherwise.
