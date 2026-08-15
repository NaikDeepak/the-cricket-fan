import ctypes
import logging
from contextlib import asynccontextmanager
from pathlib import Path

# Preload OpenMP library for LightGBM on Linux serverless runtimes
_libgomp = Path(__file__).resolve().parent.parent / "lib" / "libgomp.so.1"
if _libgomp.exists():
    try:
        ctypes.CDLL(str(_libgomp), mode=ctypes.RTLD_GLOBAL)
    except Exception:
        pass

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
            model_path = (
                Path(__file__).resolve().parent.parent
                / "bot"
                / "artifacts"
                / "model.pkl"
            )
            app.state.artifact = load_artifact(model_path)
            logger.info("Successfully loaded prediction model artifact from %s", model_path)
        except Exception as e:
            logger.warning(
                "model artifact not loaded (%s); /generate/bot prediction disabled", e
            )
            app.state.artifact = None
        yield

    app = FastAPI(title="Cricket Composer API", lifespan=lifespan)

    origins = [
        settings.cors_origin,
        "http://localhost:3000",
        "https://the-cricket-fan.vercel.app",
    ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if settings.cors_origin == "*" else origins,
        allow_credentials=True,
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
    from .routers import harvest as harvest_router
    from .routers import live_predict as live_predict_router
    from .routers import posts as posts_router
    from .routers import predictions as predictions_router
    from .routers import stories as stories_router
    from .routers import teams as teams_router

    app.include_router(drafts_router.router)
    app.include_router(content_bank_router.router)
    app.include_router(generate_router.router)
    app.include_router(analytics_router.router)
    app.include_router(predictions_router.router)
    app.include_router(live_predict_router.router)
    app.include_router(posts_router.router)
    app.include_router(stories_router.router)
    app.include_router(teams_router.router)
    app.include_router(harvest_router.router)

    return app


app = create_app()
