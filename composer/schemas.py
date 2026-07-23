import json

from pydantic import BaseModel


class DraftIn(BaseModel):
    source: str
    category: str | None = None
    text: str
    card_type: str | None = None
    card_meta: dict | None = None


class DraftPatch(BaseModel):
    text: str | None = None
    category: str | None = None
    card_type: str | None = None
    card_meta: dict | None = None


class DraftOut(BaseModel):
    id: int
    source: str
    category: str | None
    text: str
    card_type: str | None
    card_meta: dict | None
    status: str
    created_at: object
    posted_at: object


class EventIn(BaseModel):
    action: str
    platform_hint: str | None = None


class ContentBankOut(BaseModel):
    content_key: str
    category: str
    format: str
    segments: list[str]
    source: str


def row_to_out(row) -> DraftOut:
    return DraftOut(
        id=row.id,
        source=row.source,
        category=row.category,
        text=row.text,
        card_type=row.card_type,
        card_meta=json.loads(row.card_meta_json) if row.card_meta_json else None,
        status=row.status,
        created_at=row.created_at,
        posted_at=row.posted_at,
    )
