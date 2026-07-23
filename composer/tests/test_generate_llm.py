import composer.routers.generate as gen


class _FakeGemini:
    def __init__(self, payload):
        self.payload = payload

    def __call__(self, prompt, category, api_key):
        return self.payload


def test_generate_llm_creates_draft(client, monkeypatch):
    monkeypatch.setattr(
        gen,
        "gemini_generate",
        _FakeGemini(
            {"text": "Bradman averaged 99.94.", "card_meta": {"headline": "99.94"}}
        ),
    )
    monkeypatch.setattr(gen, "_gemini_key", lambda: "test-key")
    r = client.post(
        "/generate/llm", json={"prompt": "a Bradman fact", "category": "anecdote"}
    )
    assert r.status_code == 201
    out = r.json()
    assert out["source"] == "llm"
    assert out["text"] == "Bradman averaged 99.94."
    assert out["card_meta"] == {"headline": "99.94"}


def test_generate_llm_without_key_returns_503(client, monkeypatch):
    monkeypatch.setattr(gen, "_gemini_key", lambda: "")
    r = client.post("/generate/llm", json={"prompt": "x"})
    assert r.status_code == 503
    assert "GEMINI" in r.json()["detail"]
