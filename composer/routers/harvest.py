"""Harvesting and story ingestion routes for Composer."""

import secrets

from fastapi import APIRouter, Depends, Header, HTTPException

from bot.harvest.pipeline import run_pipeline

from ..config import get_settings
from ..deps import get_conn
from ..schemas import HarvestIn, HarvestOut

router = APIRouter()


def _require_harvest_token(x_harvest_token: str | None = Header(default=None)) -> None:
    """Shared-secret gate: this endpoint fetches external sources and writes
    to content_bank. There's no auth layer anywhere else in composer, and it's
    mounted on the public Vercel backend, so refuse by default rather than
    leave a write endpoint open when COMPOSER_HARVEST_TOKEN isn't set."""
    expected = get_settings().harvest_token
    if not expected:
        raise HTTPException(
            status_code=503,
            detail="Harvest endpoint disabled: COMPOSER_HARVEST_TOKEN not configured",
        )
    if not x_harvest_token or not secrets.compare_digest(x_harvest_token, expected):
        raise HTTPException(status_code=401, detail="Invalid or missing X-Harvest-Token")


@router.post(
    "/harvest/run", response_model=HarvestOut, dependencies=[Depends(_require_harvest_token)]
)
def run_harvest_pipeline(
    body: HarvestIn,
    conn=Depends(get_conn),
) -> HarvestOut:
    """Run multi-source story harvesting and deduplication pipeline."""
    result = run_pipeline(
        conn,
        sources=body.sources,
        commit=body.commit,
        similarity_threshold=body.threshold,
    )
    return HarvestOut(
        harvested_total=result["harvested_total"],
        inserted=result["inserted"],
        skipped_duplicates=result["skipped_duplicates"],
        enriched=result["enriched"],
        novel_candidates=result.get("novel_candidates", []),
        duplicate_reports=result.get("duplicate_reports", []),
    )
