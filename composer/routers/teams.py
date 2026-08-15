import json
from datetime import datetime, timezone
import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, Response

from bot.db import teams
from bot.team_seed import INITIAL_TEAMS

from ..deps import get_conn
from ..schemas import TeamIn, TeamOut, TeamPatch, team_row_to_out

router = APIRouter(tags=["teams"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


@router.get("/teams", response_model=list[TeamOut])
def list_teams(
    league: str | None = None,
    search: str | None = None,
    active_only: bool = True,
    conn=Depends(get_conn),
) -> list[TeamOut]:
    query = sa.select(teams)
    if active_only:
        query = query.where(teams.c.is_active.is_(True))
    if league and league.strip() and league != "All":
        query = query.where(teams.c.league == league.strip())
    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query = query.where(
            sa.or_(
                sa.func.lower(teams.c.name).like(term),
                sa.func.lower(teams.c.short_name).like(term),
            )
        )
    query = query.order_by(teams.c.league, teams.c.name)
    rows = conn.execute(query).fetchall()
    return [team_row_to_out(r) for r in rows]


@router.get("/teams/{team_id}", response_model=TeamOut)
def get_team(team_id: int, conn=Depends(get_conn)) -> TeamOut:
    row = conn.execute(sa.select(teams).where(teams.c.id == team_id)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Team not found")
    return team_row_to_out(row)


@router.post("/teams", response_model=TeamOut, status_code=201)
def create_team(body: TeamIn, conn=Depends(get_conn)) -> TeamOut:
    # Check if team with same name exists
    existing = conn.execute(
        sa.select(teams).where(sa.func.lower(teams.c.name) == body.name.strip().lower())
    ).fetchone()
    if existing:
        raise HTTPException(
            status_code=409, detail=f"Team with name '{body.name}' already exists."
        )

    tid = conn.execute(
        teams.insert().values(
            name=body.name.strip(),
            short_name=body.short_name.strip().upper(),
            league=body.league.strip(),
            primary_color=body.primary_color.strip(),
            secondary_color=body.secondary_color.strip(),
            accent_color=(body.accent_color or body.primary_color).strip(),
            gradient=body.gradient
            or f"linear-gradient(135deg, {body.primary_color} 0%, {body.secondary_color} 100%)",
            glow=body.glow or f"rgba(255, 255, 255, 0.4)",
            text_dark=body.text_dark,
            logo_url=body.logo_url,
            aliases_json=json.dumps(body.aliases),
            is_active=body.is_active,
            created_at=_now(),
        )
    ).inserted_primary_key[0]
    conn.commit()

    row = conn.execute(sa.select(teams).where(teams.c.id == tid)).one()
    return team_row_to_out(row)


@router.patch("/teams/{team_id}", response_model=TeamOut)
def update_team(team_id: int, body: TeamPatch, conn=Depends(get_conn)) -> TeamOut:
    existing = conn.execute(sa.select(teams).where(teams.c.id == team_id)).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Team not found")

    values: dict = {}
    if body.name is not None:
        values["name"] = body.name.strip()
    if body.short_name is not None:
        values["short_name"] = body.short_name.strip().upper()
    if body.league is not None:
        values["league"] = body.league.strip()
    if body.primary_color is not None:
        values["primary_color"] = body.primary_color.strip()
    if body.secondary_color is not None:
        values["secondary_color"] = body.secondary_color.strip()
    if body.accent_color is not None:
        values["accent_color"] = body.accent_color.strip()
    if body.gradient is not None:
        values["gradient"] = body.gradient
    if body.glow is not None:
        values["glow"] = body.glow
    if body.text_dark is not None:
        values["text_dark"] = body.text_dark
    if body.logo_url is not None:
        values["logo_url"] = body.logo_url
    if body.aliases is not None:
        values["aliases_json"] = json.dumps(body.aliases)
    if body.is_active is not None:
        values["is_active"] = body.is_active

    if values:
        conn.execute(teams.update().where(teams.c.id == team_id).values(**values))
        conn.commit()

    row = conn.execute(sa.select(teams).where(teams.c.id == team_id)).one()
    return team_row_to_out(row)


@router.delete("/teams/{team_id}", status_code=204)
def delete_team(team_id: int, conn=Depends(get_conn)) -> Response:
    existing = conn.execute(sa.select(teams).where(teams.c.id == team_id)).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Team not found")

    conn.execute(teams.delete().where(teams.c.id == team_id))
    conn.commit()
    return Response(status_code=204)


@router.post("/teams/seed", response_model=dict)
def seed_teams(conn=Depends(get_conn)) -> dict:
    inserted = 0
    now = _now()
    for t in INITIAL_TEAMS:
        exists = conn.execute(
            sa.select(teams).where(sa.func.lower(teams.c.name) == t["name"].lower())
        ).fetchone()
        if not exists:
            conn.execute(
                teams.insert().values(
                    name=t["name"],
                    short_name=t["short_name"],
                    league=t["league"],
                    primary_color=t["primary_color"],
                    secondary_color=t["secondary_color"],
                    accent_color=t.get("accent_color", t["primary_color"]),
                    gradient=t.get("gradient"),
                    glow=t.get("glow"),
                    text_dark=t.get("text_dark", False),
                    logo_url=t.get("logo_url"),
                    aliases_json=json.dumps(t.get("aliases", [])),
                    is_active=True,
                    created_at=now,
                )
            )
            inserted += 1
    conn.commit()
    return {"status": "ok", "inserted": inserted}
