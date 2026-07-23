import json
from datetime import datetime, timezone

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, Response

from bot.db import content_events, drafts

from ..deps import get_conn
from ..schemas import DraftIn, DraftOut, DraftPatch, EventIn, row_to_out

router = APIRouter()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def log_event(conn, draft_id, action, platform_hint=None) -> None:
    conn.execute(
        content_events.insert().values(
            draft_id=draft_id,
            action=action,
            platform_hint=platform_hint,
            created_at=_now(),
        )
    )


def create_draft(conn, body: DraftIn, log_generated: bool = False) -> DraftOut:
    """Shared insert used by this router and the generate router."""
    did = conn.execute(
        drafts.insert().values(
            source=body.source,
            category=body.category,
            text=body.text,
            card_type=body.card_type,
            card_meta_json=json.dumps(body.card_meta)
            if body.card_meta is not None
            else None,
            status="draft",
            created_at=_now(),
        )
    ).inserted_primary_key[0]
    if log_generated:
        log_event(conn, did, "generated")
    conn.commit()
    row = conn.execute(sa.select(drafts).where(drafts.c.id == did)).one()
    return row_to_out(row)


@router.post("/drafts", response_model=DraftOut, status_code=201)
def post_draft(body: DraftIn, conn=Depends(get_conn)) -> DraftOut:
    return create_draft(conn, body)


@router.get("/drafts", response_model=list[DraftOut])
def list_drafts(
    status: str | None = None,
    source: str | None = None,
    conn=Depends(get_conn),
) -> list[DraftOut]:
    q = sa.select(drafts).order_by(drafts.c.created_at.desc(), drafts.c.id.desc())
    if status:
        q = q.where(drafts.c.status == status)
    if source:
        q = q.where(drafts.c.source == source)
    return [row_to_out(r) for r in conn.execute(q).all()]


@router.patch("/drafts/{draft_id}", response_model=DraftOut)
def patch_draft(draft_id: int, body: DraftPatch, conn=Depends(get_conn)) -> DraftOut:
    row = conn.execute(sa.select(drafts).where(drafts.c.id == draft_id)).first()
    if row is None:
        raise HTTPException(404, "draft not found")
    updates: dict = {}
    if body.text is not None and body.text != row.text:
        updates["text"] = body.text
    if body.category is not None and body.category != row.category:
        updates["category"] = body.category
    if body.card_type is not None and body.card_type != row.card_type:
        updates["card_type"] = body.card_type
    if body.card_meta is not None:
        new_meta = json.dumps(body.card_meta)
        if new_meta != (row.card_meta_json or ""):
            updates["card_meta_json"] = new_meta
    if updates:
        conn.execute(drafts.update().where(drafts.c.id == draft_id).values(**updates))
        log_event(conn, draft_id, "edited")
        conn.commit()
    row = conn.execute(sa.select(drafts).where(drafts.c.id == draft_id)).one()
    return row_to_out(row)


@router.post("/drafts/{draft_id}/event", status_code=204)
def post_event(draft_id: int, body: EventIn, conn=Depends(get_conn)) -> Response:
    row = conn.execute(sa.select(drafts.c.id).where(drafts.c.id == draft_id)).first()
    if row is None:
        raise HTTPException(404, "draft not found")
    log_event(conn, draft_id, body.action, body.platform_hint)
    if body.action == "posted":
        conn.execute(
            drafts.update()
            .where(drafts.c.id == draft_id)
            .values(status="posted", posted_at=_now())
        )
    conn.commit()
    return Response(status_code=204)
