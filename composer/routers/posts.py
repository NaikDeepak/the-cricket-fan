import sqlalchemy as sa
from fastapi import APIRouter, Depends

from bot.db import fixtures, posts

from ..deps import get_conn
from ..schemas import PostOut

router = APIRouter()


@router.get("/posts", response_model=list[PostOut])
def list_posts(
    state: str | None = None,
    post_type: str | None = None,
    limit: int = 50,
    conn=Depends(get_conn),
) -> list[PostOut]:
    q = (
        sa.select(
            posts.c.id,
            posts.c.fixture_id,
            posts.c.post_type,
            posts.c.state,
            posts.c.text,
            posts.c.tweet_count,
            posts.c.posted_at,
            fixtures.c.team_a,
            fixtures.c.team_b,
        )
        .select_from(posts.outerjoin(fixtures, posts.c.fixture_id == fixtures.c.id))
        .order_by(posts.c.posted_at.desc().nulls_last(), posts.c.id.desc())
        .limit(limit)
    )
    if state:
        q = q.where(posts.c.state == state)
    if post_type:
        q = q.where(posts.c.post_type == post_type)
    return [
        PostOut(
            id=r.id,
            fixture_id=r.fixture_id,
            post_type=r.post_type,
            state=r.state,
            text=r.text,
            tweet_count=r.tweet_count,
            posted_at=r.posted_at,
            team_a=r.team_a,
            team_b=r.team_b,
        )
        for r in conn.execute(q).all()
    ]
