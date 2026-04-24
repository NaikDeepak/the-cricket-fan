# backend/app/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    anthropic_api_key: str
    environment: str = "development"

    model_config = SettingsConfigDict(env_file=".env.local", extra="ignore")


settings = Settings()
