"""
Search router — /api/search, /api/popular, /api/object/{id}.
Unified search across SIMBAD, NASA Exoplanet Archive, and NeoWs.
"""
import math

from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import SerializeAsAny

from models.schemas import CelestialObject, SearchResponse, IdentifyResponse
from services.simbad_service import (
    search_simbad,
    identify_by_coordinates,
    get_popular_objects,
    KNOWN_OBJECTS,
    SOLAR_SYSTEM,
    MOONS,
    ASTEROIDS,
)
from services.nasa_service import (
    fetch_exoplanet_by_name,
    fetch_exoplanet_by_coordinates,
    fetch_near_earth_asteroids,
)


router = APIRouter(prefix="/api", tags=["search"])


def get_api_key() -> str:
    import os
    return os.getenv("NASA_API_KEY", "DEMO_KEY")


def _angular_sep(ra1: float, dec1: float, ra2: float, dec2: float) -> float:
    """Great-circle angular separation between two sky points, in degrees."""
    r1, d1, r2, d2 = map(math.radians, (ra1, dec1, ra2, dec2))
    cos_sep = math.sin(d1) * math.sin(d2) + math.cos(d1) * math.cos(d2) * math.cos(r1 - r2)
    cos_sep = max(-1.0, min(1.0, cos_sep))  # clamp for float error
    return math.degrees(math.acos(cos_sep))


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


@router.get("/popular", response_model=list[SerializeAsAny[CelestialObject]])
async def popular_objects():
    """
    Return the curated list of popular objects for quick access in the observatory panel.
    """
    return get_popular_objects()


@router.get("/identify", response_model=IdentifyResponse)
async def identify(
    ra: float = Query(..., ge=0, le=360, description="Right Ascension in degrees"),
    dec: float = Query(..., ge=-90, le=90, description="Declination in degrees"),
    radius: float = Query(0.1, gt=0, le=5, description="Cone search radius in degrees"),
    api_key: str = Depends(get_api_key),
):
    """
    Identify the catalogued object nearest the given sky coordinates.

    1. SIMBAD cone search → closest catalogued object (stars, nebulae, galaxies).
    2. If it's a star, enrich via the NASA Exoplanet Archive (known host → planet data).
    Returns found=False when nothing is catalogued within the radius.
    """
    obj = await identify_by_coordinates(ra, dec, radius)

    if obj is None:
        return IdentifyResponse(
            found=False, object=None, query_ra=ra, query_dec=dec, radius_deg=radius
        )

    # Optional enrichment: a star here may be a known exoplanet host. Match by
    # position — SIMBAD names rarely string-match NASA's pl_name.
    if obj.type == "star":
        try:
            exo = await fetch_exoplanet_by_coordinates(ra, dec, api_key=api_key)
            if exo:
                obj = exo
        except Exception:
            pass  # Enrichment is non-critical

    separation = None
    if obj.ra is not None and obj.dec is not None:
        separation = _angular_sep(ra, dec, obj.ra, obj.dec)

    return IdentifyResponse(
        found=True,
        object=obj,
        query_ra=ra,
        query_dec=dec,
        radius_deg=radius,
        separation_deg=separation,
    )


@router.get("/object/{object_id}", response_model=CelestialObject)
async def get_object(
    object_id: str,
    api_key: str = Depends(get_api_key),
):
    """
    Retrieve details for a specific object by its ID.
    """
    # Check the curated catalogs (by dict key, which matches the object id)
    for catalog in (KNOWN_OBJECTS, SOLAR_SYSTEM, MOONS, ASTEROIDS):
        if object_id in catalog:
            return catalog[object_id]

    # Try exoplanet lookup
    try:
        exo = await fetch_exoplanet_by_name(object_id.replace("_", " "), api_key=api_key)
        if exo:
            return exo
    except Exception:
        pass

    raise HTTPException(status_code=404, detail=f"Object '{object_id}' not found.")
