import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

_repo_root = Path(__file__).resolve().parent.parent
load_dotenv(_repo_root / ".env.local")
load_dotenv(_repo_root / ".env")


@dataclass(frozen=True)
class Settings:
    database_url: str
    gemini_api_key: str
    cors_origin: str
    cricket_api_key: str
    cricket_api_base: str
    harvest_token: str

    @classmethod
    def from_env(cls) -> "Settings":
        db_url = (
            os.environ.get("COMPOSER_DATABASE_URL")
            or os.environ.get("BOT_DATABASE_URL")
            or os.environ.get("DATABASE_URL")
            or "sqlite:///composer.db"
        )
        if db_url.startswith("postgresql+asyncpg://"):
            # bare "postgresql://" defaults SQLAlchemy's sync engine to the
            # psycopg2 dialect, which isn't installed (root requirements.txt
            # ships psycopg[binary], i.e. psycopg3) — use the psycopg3 dialect
            # explicitly so composer's sync engine can actually connect.
            db_url = db_url.replace("postgresql+asyncpg://", "postgresql+psycopg://", 1)

        return cls(
            database_url=db_url,
            gemini_api_key=os.environ.get("GEMINI_API_KEY", ""),
            cors_origin=os.environ.get("COMPOSER_CORS_ORIGIN", "http://localhost:3000"),
            cricket_api_key=os.environ.get("CRICKET_API_KEY", ""),
            cricket_api_base=os.environ.get(
                "CRICKET_API_BASE", "https://api.cricapi.com/v1"
            ),
            harvest_token=os.environ.get("COMPOSER_HARVEST_TOKEN", ""),
        )


def get_settings() -> Settings:
    return Settings.from_env()
