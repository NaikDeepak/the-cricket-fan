import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from bot.db import ensure_schema
from bot.predict import load_artifact

from .config import get_settings
from .deps import init_engine

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        engine = init_engine(settings.database_url)
        with engine.connect() as conn:
            ensure_schema(conn)
            conn.commit()
        try:
            app.state.artifact = load_artifact(
                Path(__file__).resolve().parent.parent
                / "bot"
                / "artifacts"
                / "model.pkl"
            )
        except Exception:
            logger.warning(
                "model artifact not loaded; /generate/bot prediction disabled"
            )
            app.state.artifact = None
        yield

    app = FastAPI(title="Cricket Composer API", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.cors_origin],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    from .routers import analytics as analytics_router
    from .routers import content_bank as content_bank_router
    from .routers import drafts as drafts_router
    from .routers import generate as generate_router
    from .routers import live_predict as live_predict_router
    from .routers import posts as posts_router
    from .routers import predictions as predictions_router
    from .routers import stories as stories_router

    app.include_router(drafts_router.router)
    app.include_router(content_bank_router.router)
    app.include_router(generate_router.router)
    app.include_router(analytics_router.router)
    app.include_router(predictions_router.router)
    app.include_router(live_predict_router.router)
    app.include_router(posts_router.router)
    app.include_router(stories_router.router)

    return app


app = create_app()
