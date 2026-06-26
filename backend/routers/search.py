"""
Search router — /api/search, /api/popular, /api/object/{id}.
Unified search across SIMBAD, NASA Exoplanet Archive, and NeoWs.
"""
from fastapi import APIRouter, HTTPException, Query, Depends

from models.schemas import CelestialObject, SearchResponse
from services.simbad_service import (
    search_simbad,
    get_popular_objects,
    KNOWN_OBJECTS,
    SOLAR_SYSTEM,
)
from services.nasa_service import fetch_exoplanet_by_name, fetch_near_earth_asteroids


router = APIRouter(prefix="/api", tags=["search"])


def get_api_key() -> str:
    import os
    return os.getenv("NASA_API_KEY", "DEMO_KEY")


@router.get("/search", response_model=SearchResponse)
async def search(
    q: str = Query(..., min_length=1, description="Object name or partial name to search"),
    api_key: str = Depends(get_api_key),
):
    """
    Unified search for any astronomical object.

    Search order:
    1. Hardcoded popular objects (instant)
    2. NASA Exoplanet Archive (exoplanet name match)
    3. SIMBAD TAP query (everything else)
    """
    query = q.strip()
    results: list[CelestialObject] = []

    # 1. Check SIMBAD known objects and solar system (instant)
    simbad_result = await search_simbad(query)
    if simbad_result:
        results.append(simbad_result)

    # 2. Check NASA Exoplanet Archive (if not already found as an exoplanet)
    if not results or results[0].type != "exoplanet":
        try:
            exo_result = await fetch_exoplanet_by_name(query, api_key=api_key)
            if exo_result:
                # Don't duplicate
                if not any(r.id == exo_result.id for r in results):
                    results.append(exo_result)
        except Exception:
            pass  # Exoplanet lookup is non-critical

    return SearchResponse(query=query, results=results, total=len(results))


@router.get("/popular", response_model=list[CelestialObject])
async def popular_objects():
    """
    Return the curated list of popular objects for quick access in the observatory panel.
    """
    return get_popular_objects()


@router.get("/object/{object_id}", response_model=CelestialObject)
async def get_object(
    object_id: str,
    api_key: str = Depends(get_api_key),
):
    """
    Retrieve details for a specific object by its ID.
    """
    # Check known objects
    if object_id in KNOWN_OBJECTS:
        return KNOWN_OBJECTS[object_id]

    # Check solar system
    if object_id in SOLAR_SYSTEM:
        return SOLAR_SYSTEM[object_id]

    # Try exoplanet lookup
    try:
        exo = await fetch_exoplanet_by_name(object_id.replace("_", " "), api_key=api_key)
        if exo:
            return exo
    except Exception:
        pass

    raise HTTPException(status_code=404, detail=f"Object '{object_id}' not found.")
