# backend/app/models/player.py
from sqlalchemy import Float, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Player(Base):
    __tablename__ = "players"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    team_id: Mapped[int]


class PlayerVsPlayer(Base):
    __tablename__ = "player_vs_player"
    __table_args__ = (UniqueConstraint("batsman_id", "bowler_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    batsman_id: Mapped[int]
    bowler_id: Mapped[int]
    balls: Mapped[int] = mapped_column(default=0)
    runs: Mapped[int] = mapped_column(default=0)
    dismissals: Mapped[int] = mapped_column(default=0)
    dot_balls: Mapped[int] = mapped_column(default=0)


class VenueStats(Base):
    __tablename__ = "venue_stats"
    __table_args__ = (UniqueConstraint("venue", "team_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    venue: Mapped[str] = mapped_column(String(200))
    team_id: Mapped[int]
    matches: Mapped[int] = mapped_column(default=0)
    wins: Mapped[int] = mapped_column(default=0)
    chase_wins: Mapped[int] = mapped_column(default=0)
    chase_attempts: Mapped[int] = mapped_column(default=0)
    avg_score: Mapped[float] = mapped_column(Float, default=0.0)


class DailyCache(Base):
    __tablename__ = "daily_cache"
    id: Mapped[int] = mapped_column(primary_key=True)
    cache_key: Mapped[str] = mapped_column(String(100), unique=True)
    data: Mapped[dict] = mapped_column(JSON)
