# backend/app/models/match.py
import datetime

from sqlalchemy import Date, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Team(Base):
    __tablename__ = "teams"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    short_name: Mapped[str] = mapped_column(String(10))
    primary_color: Mapped[str] = mapped_column(String(7))  # hex


class Match(Base):
    __tablename__ = "matches"
    id: Mapped[int] = mapped_column(primary_key=True)
    team_a_id: Mapped[int]
    team_b_id: Mapped[int]
    venue: Mapped[str] = mapped_column(String(200))
    match_date: Mapped[datetime.date] = mapped_column(Date)
    match_time: Mapped[str] = mapped_column(String(20))
    is_today: Mapped[bool] = mapped_column(default=False)
