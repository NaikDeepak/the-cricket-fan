import json

import sqlalchemy as sa
from fastapi import APIRouter, Depends

from bot.db import content_bank, drafts

from ..deps import get_conn
from ..schemas import ContentBankOut

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
    used_keys = set(
        conn.execute(
            sa.select(drafts.c.content_key).where(
                drafts.c.source == "bank", drafts.c.content_key.is_not(None)
            )
        )
        .scalars()
        .all()
    )
    rows = [
        ContentBankOut(
            content_key=r.content_key,
            category=r.category,
            format=r.format,
            segments=json.loads(r.segments_json),
            source=r.source,
            used=r.content_key in used_keys,
        )
        for r in conn.execute(q).all()
    ]
    rows.sort(key=lambda r: r.used)
    return rows
