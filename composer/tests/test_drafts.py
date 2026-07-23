import sqlalchemy as sa

from bot.db import content_events


def test_create_and_list_draft_roundtrips_card_meta(client):
    body = {
        "source": "freeform",
        "category": "prediction",
        "text": "CSK favoured",
        "card_type": "prediction",
        "card_meta": {"team_a": "CSK", "team_b": "MI", "prob": 0.62},
    }
    r = client.post("/drafts", json=body)
    assert r.status_code == 201
    out = r.json()
    assert out["card_meta"] == {"team_a": "CSK", "team_b": "MI", "prob": 0.62}
    assert out["status"] == "draft"
    listed = client.get("/drafts").json()
    assert [d["id"] for d in listed] == [out["id"]]
    assert listed[0]["card_meta"] == body["card_meta"]  # object, not escaped string


def test_patch_changing_text_logs_one_edited_event(client, conn):
    did = client.post("/drafts", json={"source": "freeform", "text": "one"}).json()[
        "id"
    ]
    r = client.patch(f"/drafts/{did}", json={"text": "two"})
    assert r.status_code == 200
    assert r.json()["text"] == "two"
    n = conn.execute(
        sa.select(sa.func.count())
        .select_from(content_events)
        .where(content_events.c.action == "edited")
    ).scalar_one()
    assert n == 1


def test_patch_noop_logs_no_event(client, conn):
    did = client.post("/drafts", json={"source": "freeform", "text": "same"}).json()[
        "id"
    ]
    client.patch(f"/drafts/{did}", json={"text": "same"})  # identical
    n = conn.execute(
        sa.select(sa.func.count())
        .select_from(content_events)
        .where(content_events.c.action == "edited")
    ).scalar_one()
    assert n == 0


def test_copied_event_logs_without_status_change(client, conn):
    did = client.post("/drafts", json={"source": "freeform", "text": "x"}).json()["id"]
    r = client.post(f"/drafts/{did}/event", json={"action": "copied"})
    assert r.status_code == 204
    row = conn.execute(
        sa.select(content_events).where(content_events.c.draft_id == did)
    ).one()
    assert row.action == "copied"
    draft = client.get("/drafts").json()[0]
    assert draft["status"] == "draft"  # copy does not post


def test_posted_event_flips_status_and_sets_posted_at(client):
    did = client.post("/drafts", json={"source": "freeform", "text": "x"}).json()["id"]
    client.post(f"/drafts/{did}/event", json={"action": "posted", "platform_hint": "x"})
    draft = client.get("/drafts").json()[0]
    assert draft["status"] == "posted"
    assert draft["posted_at"] is not None


def test_bank_draft_roundtrips_content_key(client):
    body = {
        "source": "bank",
        "category": "anecdote",
        "text": "Bodyline changed cricket.",
        "content_key": "anecdote:bodyline",
    }
    out = client.post("/drafts", json=body).json()
    assert out["content_key"] == "anecdote:bodyline"
    listed = client.get("/drafts").json()
    assert listed[0]["content_key"] == "anecdote:bodyline"


def test_freeform_draft_has_null_content_key(client):
    out = client.post("/drafts", json={"source": "freeform", "text": "x"}).json()
    assert out["content_key"] is None
