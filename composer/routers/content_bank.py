import json
from datetime import datetime, timezone

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException

from bot.db import content_bank, drafts

from ..deps import get_conn
from ..schemas import ContentBankOut, PublishIn

router = APIRouter()


@router.get("/content-bank", response_model=list[ContentBankOut])
def list_content_bank(
    category: str | None = None,
    limit: int = 100,
    offset: int = 0,
    conn=Depends(get_conn),
) -> list[ContentBankOut]:
    q = sa.select(content_bank).order_by(content_bank.c.id.desc())
    if category:
        q = q.where(content_bank.c.category == category)
    q = q.limit(limit).offset(offset)
    now = datetime.now(timezone.utc)
    today_md = now.strftime("%m-%d")
    last_used_at: dict[str, datetime] = dict(
        conn.execute(
            sa.select(drafts.c.content_key, sa.func.max(drafts.c.created_at))
            .where(drafts.c.source == "bank", drafts.c.content_key.is_not(None))
            .group_by(drafts.c.content_key)
        ).all()
    )
    rows = []
    for r in conn.execute(q).all():
        used_at = last_used_at.get(r.content_key)
        if used_at is not None and used_at.tzinfo is None:
            used_at = used_at.replace(tzinfo=timezone.utc)
        rows.append(
            ContentBankOut(
                id=r.id,
                content_key=r.content_key,
                category=r.category,
                format=r.format,
                segments=json.loads(r.segments_json),
                source=r.source,
                last_used_days=(now - used_at).days if used_at is not None else None,
                event_month_day=r.event_month_day,
                on_this_day=r.event_month_day == today_md,
                is_published=bool(r.is_published)
                if r.is_published is not None
                else True,
            )
        )
    # on-this-day matches first, ahead of everything else; within each group,
    # never-used first, then longest-unused (largest days) first
    rows.sort(
        key=lambda r: (
            0 if r.on_this_day else 1,
            0 if r.last_used_days is None else 1,
            -(r.last_used_days or 0),
        )
    )
    return rows


@router.patch("/content-bank/{item_id}/publish", response_model=ContentBankOut)
def set_published(
    item_id: int, body: PublishIn, conn=Depends(get_conn)
) -> ContentBankOut:
    row = conn.execute(
        sa.select(content_bank).where(content_bank.c.id == item_id)
    ).first()
    if row is None:
        raise HTTPException(404, f"content bank item {item_id} not found")
    conn.execute(
        sa.update(content_bank)
        .where(content_bank.c.id == item_id)
        .values(is_published=body.is_published)
    )
    conn.commit()
    r = conn.execute(sa.select(content_bank).where(content_bank.c.id == item_id)).one()
    return ContentBankOut(
        id=r.id,
        content_key=r.content_key,
        category=r.category,
        format=r.format,
        segments=json.loads(r.segments_json),
        source=r.source,
        event_month_day=r.event_month_day,
        is_published=bool(r.is_published),
    )
