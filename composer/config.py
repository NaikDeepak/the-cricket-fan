import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    database_url: str
    gemini_api_key: str
    cors_origin: str

    @classmethod
    def from_env(cls) -> "Settings":
        db_url = (
            os.environ.get("COMPOSER_DATABASE_URL")
            or os.environ.get("BOT_DATABASE_URL")
            or os.environ.get("DATABASE_URL")
            or "sqlite:///composer.db"
        )
        if db_url.startswith("postgresql+asyncpg://"):
            db_url = db_url.replace("postgresql+asyncpg://", "postgresql://", 1)

        return cls(
            database_url=db_url,
            gemini_api_key=os.environ.get("GEMINI_API_KEY", ""),
            cors_origin=os.environ.get("COMPOSER_CORS_ORIGIN", "http://localhost:3000"),
        )


def get_settings() -> Settings:
    return Settings.from_env()
