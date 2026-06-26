"""
Exoplanets router — /api/exoplanets endpoints.
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic_settings import BaseSettings

from models.schemas import ExoplanetResponse
from services.nasa_service import fetch_exoplanets, fetch_exoplanet_by_name


router = APIRouter(prefix="/api/exoplanets", tags=["exoplanets"])


def get_api_key() -> str:
    """Retrieve NASA API key from environment."""
    import os
    return os.getenv("NASA_API_KEY", "DEMO_KEY")


@router.get("", response_model=list[ExoplanetResponse])
async def list_exoplanets(
    limit: int = Query(default=50, ge=1, le=500, description="Number of exoplanets to return"),
    habitable: bool = Query(default=False, description="Filter to potentially habitable zone planets"),
    api_key: str = Depends(get_api_key),
):
    """
    Return a list of confirmed exoplanets from the NASA Exoplanet Archive.

    - **limit**: Number of results (max 500)
    - **habitable**: If true, returns only potentially habitable zone planets
    """
    try:
        results = await fetch_exoplanets(limit=limit, habitable_only=habitable, api_key=api_key)
        return results
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/{name}", response_model=ExoplanetResponse)
async def get_exoplanet(
    name: str,
    api_key: str = Depends(get_api_key),
):
    """
    Get details for a specific exoplanet by name (e.g. 'Kepler-452 b').
    """
    result = await fetch_exoplanet_by_name(name, api_key=api_key)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Exoplanet '{name}' not found.")
    return result
