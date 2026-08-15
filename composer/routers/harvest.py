"""Harvesting and story ingestion routes for Composer."""

from fastapi import APIRouter, Depends

from bot.harvest.pipeline import run_pipeline

from ..deps import get_conn
from ..schemas import HarvestIn, HarvestOut

router = APIRouter()


@router.post("/harvest/run", response_model=HarvestOut)
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
