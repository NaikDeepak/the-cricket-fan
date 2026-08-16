"""Tests for harvesting harvesters and pipeline."""

from bot.harvest.pipeline import harvest_all_sources, run_pipeline
from bot.harvest.quora_memoirs import harvest_quora_memoirs
from bot.harvest.reddit import harvest_reddit_lore
from bot.harvest.wikipedia import harvest_wikipedia_stories


def test_individual_harvesters_return_valid_shapes():
    wiki = harvest_wikipedia_stories()
    assert len(wiki) >= 10
    assert all("content_key" in w and "title" in w and "segments" in w for w in wiki)

    reddit = harvest_reddit_lore()
    assert len(reddit) >= 5
    assert all(r["source_type"] == "reddit" for r in reddit)

    quora = harvest_quora_memoirs()
    assert len(quora) >= 5
    assert all(q["source_type"] in ["quora", "memoir", "interview"] for q in quora)


def test_harvest_all_sources():
    all_stories = harvest_all_sources(["wikipedia", "reddit", "quora"])
    assert len(all_stories) >= 20
    keys = [s["content_key"] for s in all_stories]
    # Verify no duplicate keys across the curated sources
    assert len(keys) == len(set(keys))


def test_run_pipeline_idempotence(engine):
    with engine.begin() as conn:
        res1 = run_pipeline(conn, sources=["wikipedia", "reddit", "quora"], commit=True)
        res2 = run_pipeline(conn, sources=["wikipedia", "reddit", "quora"], commit=True)

    assert res1["inserted"] > 0
    assert res2["inserted"] == 0
    assert res2["skipped_duplicates"] == res1["harvested_total"]
