"""
NASA API Service — async calls to NASA Exoplanet Archive and NeoWs.
All results are cached in-memory to avoid hitting rate limits.
"""
from __future__ import annotations

import asyncio
import time
from typing import Any, Dict, List, Optional, Tuple
import httpx

from models.schemas import (
    AsteroidCloseApproach,
    AsteroidData,
    AsteroidResponse,
    CelestialObject,
    ExoplanetData,
    ExoplanetResponse,
)


# Simple in-memory cache: key → (data, timestamp)
_cache: Dict[str, Tuple[Any, float]] = {}
CACHE_TTL_SECONDS = 3600  # 1 hour


def _get_cached(key: str) -> Optional[Any]:
    if key in _cache:
        data, ts = _cache[key]
        if time.time() - ts < CACHE_TTL_SECONDS:
            return data
    return None


def _set_cached(key: str, data: Any) -> None:
    _cache[key] = (data, time.time())


# NASA Exoplanet Archive TAP endpoint
EXOPLANET_BASE = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync"

# NASA NeoWs (Near Earth Objects)
NEOWS_BASE = "https://api.nasa.gov/neo/rest/v1"


async def fetch_exoplanets(
    limit: int = 50,
    habitable_only: bool = False,
    api_key: str = "DEMO_KEY",
) -> List[ExoplanetResponse]:
    """Query the NASA Exoplanet Archive for confirmed exoplanets."""
    cache_key = f"exoplanets:{limit}:{habitable_only}"
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    # ADQL query for exoplanet data
    if habitable_only:
        # Habitable zone rough estimate: equilibrium temp 200-350K, radius 0.5-2.0 Earth radii
        where_clause = (
            "default_flag=1 AND pl_rade IS NOT NULL "
            "AND pl_rade < 2.0 AND pl_rade > 0.5 "
            "AND pl_eqt IS NOT NULL AND pl_eqt > 200 AND pl_eqt < 350"
        )
    else:
        where_clause = "default_flag=1 AND pl_rade IS NOT NULL"

    query = (
        f"SELECT pl_name, pl_rade, pl_masse, pl_orbper, pl_orbsmax, "
        f"st_teff, st_rad, sy_dist, ra, dec, pl_eqt "
        f"FROM ps WHERE {where_clause} "
        f"ORDER BY sy_dist ASC "
        f"LIMIT {limit}"
    )

    params = {"query": query, "format": "json"}

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.get(EXOPLANET_BASE, params=params)
            resp.raise_for_status()
            raw_data = resp.json()
        except httpx.TimeoutException:
            raise RuntimeError("NASA Exoplanet Archive timed out")
        except httpx.HTTPStatusError as e:
            raise RuntimeError(f"NASA Exoplanet Archive returned {e.response.status_code}")

    results: List[ExoplanetResponse] = []
    for row in raw_data:
        name = row.get("pl_name", "Unknown")
        # Convert distance from parsecs to light-years
        dist_parsec = row.get("sy_dist")
        dist_ly = dist_parsec * 3.26156 if dist_parsec is not None else None

        star_temp = row.get("st_teff")
        eq_temp = row.get("pl_eqt")
        radius = row.get("pl_rade")

        is_habitable = (
            eq_temp is not None
            and 200 <= eq_temp <= 350
            and radius is not None
            and 0.5 <= radius <= 2.0
        )

        exo_data = ExoplanetData(
            radius_earth=radius,
            mass_earth=row.get("pl_masse"),
            orbital_period_days=row.get("pl_orbper"),
            semi_major_axis_au=row.get("pl_orbsmax"),
            star_temperature_k=star_temp,
            star_radius_solar=row.get("st_rad"),
            equilibrium_temp_k=eq_temp,
            is_habitable=is_habitable,
        )

        planet = ExoplanetResponse(
            id=name.lower().replace(" ", "_").replace("-", "_"),
            name=name,
            type="exoplanet",
            ra=row.get("ra"),
            dec=row.get("dec"),
            distance_ly=dist_ly,
            description=_describe_exoplanet(exo_data),
            exoplanet=exo_data,
        )
        results.append(planet)

    _set_cached(cache_key, results)
    return results


async def fetch_exoplanet_by_name(name: str, api_key: str = "DEMO_KEY") -> Optional[ExoplanetResponse]:
    """Fetch a single exoplanet by name."""
    # Try to find in our cached full list first
    all_planets = await fetch_exoplanets(limit=500, api_key=api_key)
    name_lower = name.lower().strip()
    for planet in all_planets:
        if planet.name.lower() == name_lower or planet.id == name_lower.replace(" ", "_"):
            return planet

    # Direct query if not in cache
    query = (
        f"SELECT pl_name, pl_rade, pl_masse, pl_orbper, pl_orbsmax, "
        f"st_teff, st_rad, sy_dist, ra, dec, pl_eqt "
        f"FROM ps WHERE default_flag=1 AND LOWER(pl_name) LIKE '%{name_lower}%' LIMIT 1"
    )
    params = {"query": query, "format": "json"}

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.get(EXOPLANET_BASE, params=params)
            resp.raise_for_status()
            raw_data = resp.json()
        except Exception:
            return None

    if not raw_data:
        return None

    row = raw_data[0]
    name_found = row.get("pl_name", "Unknown")
    dist_parsec = row.get("sy_dist")
    dist_ly = dist_parsec * 3.26156 if dist_parsec is not None else None

    exo_data = ExoplanetData(
        radius_earth=row.get("pl_rade"),
        mass_earth=row.get("pl_masse"),
        orbital_period_days=row.get("pl_orbper"),
        semi_major_axis_au=row.get("pl_orbsmax"),
        star_temperature_k=row.get("st_teff"),
        star_radius_solar=row.get("st_rad"),
        equilibrium_temp_k=row.get("pl_eqt"),
    )

    return ExoplanetResponse(
        id=name_found.lower().replace(" ", "_").replace("-", "_"),
        name=name_found,
        type="exoplanet",
        ra=row.get("ra"),
        dec=row.get("dec"),
        distance_ly=dist_ly,
        description=_describe_exoplanet(exo_data),
        exoplanet=exo_data,
    )


async def fetch_near_earth_asteroids(
    start_date: str,
    end_date: str,
    api_key: str = "DEMO_KEY",
) -> List[AsteroidResponse]:
    """Fetch near-Earth asteroids from NASA NeoWs API."""
    cache_key = f"asteroids:{start_date}:{end_date}"
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    url = f"{NEOWS_BASE}/feed"
    params = {"start_date": start_date, "end_date": end_date, "api_key": api_key}

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
        except httpx.TimeoutException:
            raise RuntimeError("NASA NeoWs timed out")
        except httpx.HTTPStatusError as e:
            raise RuntimeError(f"NASA NeoWs returned {e.response.status_code}")

    results: List[AsteroidResponse] = []
    near_earth_objects = data.get("near_earth_objects", {})

    for date_key, asteroid_list in near_earth_objects.items():
        for ast in asteroid_list:
            name = ast.get("name", "Unknown").strip("()")
            diameter_data = ast.get("estimated_diameter", {}).get("kilometers", {})
            close_approaches = ast.get("close_approach_data", [])

            approach: Optional[AsteroidCloseApproach] = None
            if close_approaches:
                ca = close_approaches[0]
                miss_km = float(ca.get("miss_distance", {}).get("kilometers", 0))
                rel_vel = float(ca.get("relative_velocity", {}).get("kilometers_per_second", 0))
                miss_au = float(ca.get("miss_distance", {}).get("astronomical", 0))
                approach = AsteroidCloseApproach(
                    date=ca.get("close_approach_date", date_key),
                    relative_velocity_km_s=rel_vel,
                    miss_distance_km=miss_km,
                    miss_distance_au=miss_au,
                )

            asteroid_data = AsteroidData(
                diameter_min_km=diameter_data.get("estimated_diameter_min"),
                diameter_max_km=diameter_data.get("estimated_diameter_max"),
                is_potentially_hazardous=ast.get("is_potentially_hazardous_asteroid", False),
                absolute_magnitude=ast.get("absolute_magnitude_h"),
            )

            dist_au = approach.miss_distance_au if approach else None

            asteroid = AsteroidResponse(
                id=str(ast.get("id", name.lower().replace(" ", "_"))),
                name=name,
                type="asteroid",
                distance_au=dist_au,
                description=f"Near-Earth asteroid making a close approach on {date_key}.",
                asteroid=asteroid_data,
                close_approach=approach,
            )
            results.append(asteroid)

    _set_cached(cache_key, results)
    return results


def _describe_exoplanet(data: ExoplanetData) -> str:
    """Generate a human-readable description for an exoplanet."""
    parts = []
    if data.radius_earth is not None:
        if data.radius_earth < 0.8:
            parts.append("a sub-Earth sized world")
        elif data.radius_earth <= 1.5:
            parts.append("an Earth-sized rocky world")
        elif data.radius_earth <= 4.0:
            parts.append("a super-Earth or mini-Neptune")
        else:
            parts.append("a gas giant")

    if data.equilibrium_temp_k is not None:
        temp = data.equilibrium_temp_k
        if temp < 200:
            parts.append("with a frigid frozen surface")
        elif temp <= 350:
            parts.append("potentially in the habitable zone")
        elif temp <= 700:
            parts.append("too hot for liquid water")
        else:
            parts.append("with a scorching hot surface")

    if data.star_temperature_k is not None:
        parts.append(f"orbiting a star at {data.star_temperature_k:.0f}K")

    return (". It is ".join(parts) + ".").capitalize() if parts else "An exoplanet beyond our solar system."
