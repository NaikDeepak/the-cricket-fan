import json
from datetime import datetime, timezone


from bot.db import content_bank, ensure_schema


def test_list_stories_returns_filtered_and_searched(client, engine):
    now = datetime(2026, 7, 24, tzinfo=timezone.utc)
    with engine.begin() as conn:
        ensure_schema(conn)
        conn.execute(
            content_bank.insert().values(
                content_key="story:kolkata-2001",
                category="story",
                format="thread",
                segments_json=json.dumps(["Kolkata miracle Laxman 281"]),
                source="wikipedia:Kolkata_Test_2001",
                title="The Kolkata Miracle (2001)",
                summary="Laxman 281 and Dravid 180",
                teams_json=json.dumps(["India", "Australia"]),
                players_json=json.dumps(["VVS Laxman", "Rahul Dravid"]),
                venue="Eden Gardens, Kolkata",
                year=2001,
                match_format="Test",
                tags_json=json.dumps(["miracle", "comeback"]),
                created_at=now,
            )
        )

    res = client.get("/stories")
    assert res.status_code == 200
    items = res.json()
    assert len(items) >= 1
    kolkata = next(s for s in items if s["content_key"] == "story:kolkata-2001")
    assert kolkata["title"] == "The Kolkata Miracle (2001)"
    assert "India" in kolkata["teams"]
    assert "VVS Laxman" in kolkata["players"]

    # Filter by player
    res_player = client.get("/stories?player=Laxman")
    assert res_player.status_code == 200
    assert len(res_player.json()) == 1

    # Filter by non-matching player
    res_empty = client.get("/stories?player=Sachin")
    assert res_empty.status_code == 200
    assert len(res_empty.json()) == 0

    # Search
    res_search = client.get("/stories?search=Dravid")
    assert res_search.status_code == 200
    assert len(res_search.json()) == 1


def test_get_contextual_stories(client, engine):
    now = datetime(2026, 7, 24, tzinfo=timezone.utc)

    with engine.begin() as conn:
        ensure_schema(conn)
        conn.execute(
            content_bank.insert().values(
                content_key="story:kolkata-2001",
                category="story",
                format="thread",
                segments_json=json.dumps(["Kolkata miracle"]),
                source="wikipedia:Kolkata_Test_2001",
                title="The Kolkata Miracle (2001)",
                summary="Laxman 281",
                teams_json=json.dumps(["India", "Australia"]),
                venue="Eden Gardens",
                created_at=now,
            )
        )

    res = client.get("/stories/contextual?team_a=India&team_b=Australia")
    assert res.status_code == 200
    stories = res.json()
    assert len(stories) >= 1
    assert stories[0]["content_key"] == "story:kolkata-2001"


def test_wire_returns_posted_drafts_newest_first(client, engine):
    from bot.db import drafts

    with engine.begin() as conn:
        ensure_schema(conn)
        for i, (status, posted_at) in enumerate(
            [
                ("draft", None),
                ("posted", datetime(2026, 8, 1, tzinfo=timezone.utc)),
                ("posted", datetime(2026, 8, 10, tzinfo=timezone.utc)),
            ]
        ):
            conn.execute(
                drafts.insert().values(
                    source="bank",
                    category="record",
                    text=f"tweet {i}",
                    status=status,
                    created_at=datetime(2026, 7, 30, tzinfo=timezone.utc),
                    posted_at=posted_at,
                )
            )

    res = client.get("/stories/wire")
    assert res.status_code == 200
    items = res.json()
    assert [i["text"] for i in items] == [
        "tweet 2",
        "tweet 1",
    ]  # posted only, newest first
    assert items[0]["posted_at"] is not None

    res_limited = client.get("/stories/wire?limit=1")
    assert len(res_limited.json()) == 1


def _insert_bank_row(conn, key: str, published: bool = True) -> None:
    conn.execute(
        content_bank.insert().values(
            content_key=key,
            category="story",
            format="single",
            segments_json=json.dumps([f"segment for {key}"]),
            source="test",
            title=key,
            summary="s",
            created_at=datetime(2026, 8, 1, tzinfo=timezone.utc),
            is_published=published,
        )
    )


def test_unpublished_hidden_from_listings_but_direct_fetch_works(client, engine):
    with engine.begin() as conn:
        ensure_schema(conn)
        _insert_bank_row(conn, "story:visible", published=True)
        _insert_bank_row(conn, "story:hidden", published=False)

    keys = [s["content_key"] for s in client.get("/stories").json()]
    assert "story:visible" in keys
    assert "story:hidden" not in keys

    assert client.get("/stories/story:hidden").status_code == 200


def test_publish_patch_flips_flag(client, engine):
    with engine.begin() as conn:
        ensure_schema(conn)
        _insert_bank_row(conn, "story:flipme", published=True)

    items = client.get("/content-bank").json()
    item = next(i for i in items if i["content_key"] == "story:flipme")
    assert item["is_published"] is True

    res = client.patch(
        f"/content-bank/{item['id']}/publish", json={"is_published": False}
    )
    assert res.status_code == 200
    assert res.json()["is_published"] is False

    keys = [s["content_key"] for s in client.get("/stories").json()]
    assert "story:flipme" not in keys

    res = client.patch("/content-bank/99999/publish", json={"is_published": True})
    assert res.status_code == 404


def test_story_exposes_event_month_day(client, engine):
    with engine.begin() as conn:
        ensure_schema(conn)
        conn.execute(
            content_bank.insert().values(
                content_key="story:dated",
                category="story",
                format="single",
                segments_json=json.dumps(["a"]),
                source="test",
                title="Dated",
                summary="s",
                event_month_day="08-13",
                created_at=datetime(2026, 8, 1, tzinfo=timezone.utc),
            )
        )
    s = client.get("/stories/story:dated").json()
    assert s["event_month_day"] == "08-13"
