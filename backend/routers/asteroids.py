"""
Asteroids router — /api/asteroids endpoints.
"""
from datetime import date, timedelta
from fastapi import APIRouter, HTTPException, Query, Depends

from models.schemas import AsteroidResponse
from services.nasa_service import fetch_near_earth_asteroids


router = APIRouter(prefix="/api/asteroids", tags=["asteroids"])


def get_api_key() -> str:
    import os
    return os.getenv("NASA_API_KEY", "DEMO_KEY")


@router.get("/today", response_model=list[AsteroidResponse])
async def get_today_asteroids(api_key: str = Depends(get_api_key)):
    """
    Return near-Earth asteroids making close approaches today (and tomorrow).
    """
    today = date.today().isoformat()
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    try:
        results = await fetch_near_earth_asteroids(
            start_date=today, end_date=tomorrow, api_key=api_key
        )
        # Sort by miss distance (closest first)
        results.sort(
            key=lambda a: a.close_approach.miss_distance_km if a.close_approach else float("inf")
        )
        return results
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("", response_model=list[AsteroidResponse])
async def get_asteroids_by_date(
    start_date: str = Query(..., description="Start date YYYY-MM-DD"),
    end_date: str = Query(..., description="End date YYYY-MM-DD (max 7 days from start)"),
    api_key: str = Depends(get_api_key),
):
    """
    Return near-Earth asteroids between two dates (max 7-day window per NASA API limits).
    """
    try:
        start = date.fromisoformat(start_date)
        end = date.fromisoformat(end_date)
    except ValueError:
        raise HTTPException(status_code=422, detail="Dates must be in YYYY-MM-DD format.")

    if (end - start).days > 7:
        raise HTTPException(status_code=422, detail="Date range cannot exceed 7 days (NASA API limit).")

    try:
        results = await fetch_near_earth_asteroids(
            start_date=start_date, end_date=end_date, api_key=api_key
        )
        return results
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
