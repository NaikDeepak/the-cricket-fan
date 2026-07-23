import json

import sqlalchemy as sa
from fastapi import APIRouter, Depends

from bot.db import content_bank

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
    return [
        ContentBankOut(
            content_key=r.content_key,
            category=r.category,
            format=r.format,
            segments=json.loads(r.segments_json),
            source=r.source,
        )
        for r in conn.execute(q).all()
    ]
