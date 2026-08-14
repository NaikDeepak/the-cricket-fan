# backend/app/main.py
import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path

# Ensure repo root is on sys.path for composer and bot imports
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from .database import engine  # noqa: E402
from .models.base import Base  # noqa: E402
from .models import match, player  # noqa: F401, E402 — registers models with Base
from .api import story, trivia, prediction, stats, matches  # noqa: E402

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Initialize composer database and artifact if available
    try:
        from composer.config import get_settings
        from composer.deps import init_engine
        from bot.db import ensure_schema
        from bot.predict import load_artifact

        composer_settings = get_settings()
        c_engine = init_engine(composer_settings.database_url)
        with c_engine.connect() as conn:
            ensure_schema(conn)
            conn.commit()
        try:
            artifact_path = (
                Path(__file__).resolve().parent.parent.parent
                / "bot"
                / "artifacts"
                / "model.pkl"
            )
            app.state.artifact = load_artifact(artifact_path)
        except Exception:
            app.state.artifact = None
    except Exception as e:
        logger.warning("Could not initialize composer subsystem: %s", e)
        app.state.artifact = None

    yield


app = FastAPI(title="The Cricket Fan API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://*.vercel.app", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(story.router)
app.include_router(trivia.router)
app.include_router(prediction.router)
app.include_router(stats.router)
app.include_router(matches.router)

# Mount Composer routers (live-predict, drafts, predictions, etc.)
try:
    from composer.routers import (
        analytics as analytics_router,
        content_bank as content_bank_router,
        drafts as drafts_router,
        generate as generate_router,
        live_predict as live_predict_router,
        posts as posts_router,
        predictions as predictions_router,
        stories as stories_router,
    )

    app.include_router(drafts_router.router)
    app.include_router(content_bank_router.router)
    app.include_router(generate_router.router)
    app.include_router(analytics_router.router)
    app.include_router(predictions_router.router)
    app.include_router(live_predict_router.router)
    app.include_router(posts_router.router)
    app.include_router(stories_router.router)
except Exception as e:
    logger.warning("Could not mount composer routers: %s", e)


@app.get("/health")
async def health():
    return {"status": "ok"}

