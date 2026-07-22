import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    database_url: str
    dry_run: bool
    force_trivia: bool
    cricket_api_key: str
    cricket_api_base: str
    x_api_key: str
    x_api_secret: str
    x_access_token: str
    x_access_token_secret: str

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            database_url=os.environ.get("BOT_DATABASE_URL", ""),
            dry_run=os.environ.get("BOT_DRY_RUN", "0") == "1",
            force_trivia=os.environ.get("BOT_FORCE_TRIVIA", "0") == "1",
            cricket_api_key=os.environ.get("CRICKET_API_KEY", ""),
            cricket_api_base=os.environ.get(
                "CRICKET_API_BASE", "https://api.cricapi.com/v1"
            ),
            x_api_key=os.environ.get("X_API_KEY", ""),
            x_api_secret=os.environ.get("X_API_SECRET", ""),
            x_access_token=os.environ.get("X_ACCESS_TOKEN", ""),
            x_access_token_secret=os.environ.get("X_ACCESS_TOKEN_SECRET", ""),
        )


def get_settings() -> Settings:
    return Settings.from_env()
