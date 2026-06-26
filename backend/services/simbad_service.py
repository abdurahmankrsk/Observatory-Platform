"""
SIMBAD Astronomical Database service — searches for named objects via TAP.
Covers stars, nebulae, galaxies, and other deep-sky objects.
"""
from __future__ import annotations

import time
from typing import Any, Dict, List, Optional, Tuple
import httpx

from models.schemas import CelestialObject, StarData, StarResponse


_cache: Dict[str, Tuple[Any, float]] = {}
CACHE_TTL_SECONDS = 3600


def _get_cached(key: str) -> Optional[Any]:
    if key in _cache:
        data, ts = _cache[key]
        if time.time() - ts < CACHE_TTL_SECONDS:
            return data
    return None


def _set_cached(key: str, data: Any) -> None:
    _cache[key] = (data, time.time())


SIMBAD_TAP = "http://simbad.u-strasbg.fr/simbad/sim-tap/sync"

# Hardcoded well-known objects for instant lookup (fallback/popular list)
KNOWN_OBJECTS: Dict[str, CelestialObject] = {
    "andromeda": CelestialObject(
        id="andromeda",
        name="Andromeda Galaxy (M31)",
        type="galaxy",
        ra=10.6847929,
        dec=41.269065,
        distance_ly=2537000,
        description="The nearest large spiral galaxy to the Milky Way, on a collision course with us in ~4.5 billion years.",
        fun_fact="Andromeda contains roughly one trillion stars — more than double the Milky Way.",
    ),
    "m31": CelestialObject(
        id="andromeda",
        name="Andromeda Galaxy (M31)",
        type="galaxy",
        ra=10.6847929,
        dec=41.269065,
        distance_ly=2537000,
        description="The nearest large spiral galaxy to the Milky Way, on a collision course with us in ~4.5 billion years.",
        fun_fact="Andromeda contains roughly one trillion stars — more than double the Milky Way.",
    ),
    "orion nebula": CelestialObject(
        id="orion_nebula",
        name="Orion Nebula (M42)",
        type="nebula",
        ra=83.8221,
        dec=-5.3911,
        distance_ly=1344,
        description="A stellar nursery in the constellation Orion, one of the most studied objects in the night sky.",
        fun_fact="The Orion Nebula is 24 light-years across and contains over 700 stars in various stages of formation.",
    ),
    "m42": CelestialObject(
        id="orion_nebula",
        name="Orion Nebula (M42)",
        type="nebula",
        ra=83.8221,
        dec=-5.3911,
        distance_ly=1344,
        description="A stellar nursery in the constellation Orion, one of the most studied objects in the night sky.",
        fun_fact="The Orion Nebula is 24 light-years across and contains over 700 stars in various stages of formation.",
    ),
    "vega": StarResponse(
        id="vega",
        name="Vega",
        type="star",
        ra=279.23473,
        dec=38.78369,
        distance_ly=25.04,
        description="The brightest star in the constellation Lyra, and the second-brightest star in the northern sky.",
        fun_fact="Vega rotates so fast it's noticeably flattened at the poles — its equatorial radius is 19% larger than its polar radius.",
        star=StarData(temperature_k=9602, radius_solar=2.362, spectral_type="A0Va"),
    ),
    "sirius": StarResponse(
        id="sirius",
        name="Sirius",
        type="star",
        ra=101.28715,
        dec=-16.71611,
        distance_ly=8.6,
        description="The brightest star in Earth's night sky, in the constellation Canis Major.",
        fun_fact="Sirius is actually a binary system — Sirius A orbited by the white dwarf Sirius B.",
        star=StarData(temperature_k=9940, radius_solar=1.711, spectral_type="A1V"),
    ),
    "betelgeuse": StarResponse(
        id="betelgeuse",
        name="Betelgeuse",
        type="star",
        ra=88.79292,
        dec=7.40706,
        distance_ly=700,
        description="A red supergiant in Orion, one of the largest known stars, expected to explode as a supernova.",
        fun_fact="If Betelgeuse replaced our Sun, its surface would extend past Jupiter's orbit.",
        star=StarData(temperature_k=3500, radius_solar=887, spectral_type="M1-M2"),
    ),
    "horsehead nebula": CelestialObject(
        id="horsehead_nebula",
        name="Horsehead Nebula (IC 434)",
        type="nebula",
        ra=85.2448,
        dec=-2.4583,
        distance_ly=1375,
        description="A dark nebula in Orion shaped like a chess knight, silhouetted against glowing ionized hydrogen.",
        fun_fact="The Horsehead Nebula is slowly evaporating due to ultraviolet radiation from nearby hot stars.",
    ),
    "crab nebula": CelestialObject(
        id="crab_nebula",
        name="Crab Nebula (M1)",
        type="nebula",
        ra=83.6287,
        dec=22.0147,
        distance_ly=6523,
        description="The remnant of a supernova explosion recorded by Chinese astronomers in 1054 AD.",
        fun_fact="At the heart of the Crab Nebula is a pulsar spinning 30 times per second.",
    ),
    "milky way": CelestialObject(
        id="milky_way",
        name="Milky Way Galaxy",
        type="galaxy",
        ra=266.4168,
        dec=-28.9364,
        distance_ly=0,
        description="Our home galaxy — a barred spiral galaxy containing 100-400 billion stars.",
        fun_fact="The Milky Way is approximately 100,000 light-years in diameter and about 1,000 light-years thick.",
    ),
    "pleiades": CelestialObject(
        id="pleiades",
        name="Pleiades (M45)",
        type="nebula",
        ra=56.75,
        dec=24.1167,
        distance_ly=444,
        description="An open star cluster in Taurus, also known as the Seven Sisters, visible to the naked eye.",
        fun_fact="The Pleiades are only about 100 million years old — extremely young by cosmic standards.",
    ),
}

# Solar system objects (approximate current positions, RA/Dec will be simulated)
SOLAR_SYSTEM: Dict[str, CelestialObject] = {
    "mars": CelestialObject(
        id="mars",
        name="Mars",
        type="planet",
        distance_au=1.524,
        description="The Red Planet, fourth from the Sun, home to Olympus Mons — the largest volcano in the solar system.",
        fun_fact="A day on Mars (a sol) is 24 hours and 37 minutes — almost the same as Earth.",
    ),
    "jupiter": CelestialObject(
        id="jupiter",
        name="Jupiter",
        type="planet",
        distance_au=5.203,
        description="The largest planet in our solar system, a gas giant with the famous Great Red Spot.",
        fun_fact="Jupiter's Great Red Spot is a storm that has been raging for at least 350 years.",
    ),
    "saturn": CelestialObject(
        id="saturn",
        name="Saturn",
        type="planet",
        distance_au=9.537,
        description="The ringed jewel of our solar system, a gas giant with spectacular icy rings.",
        fun_fact="Saturn's rings are mostly made of ice particles — some as small as grains of sand, others as large as mountains.",
    ),
    "neptune": CelestialObject(
        id="neptune",
        name="Neptune",
        type="planet",
        distance_au=30.07,
        description="The farthest planet from the Sun, an ice giant with the strongest winds in the solar system.",
        fun_fact="Winds on Neptune can reach 2,100 km/h — faster than the speed of sound on Earth.",
    ),
}


async def search_simbad(query: str) -> Optional[CelestialObject]:
    """Search SIMBAD database for a named astronomical object."""
    query_lower = query.lower().strip()

    # Check known objects first (instant response)
    if query_lower in KNOWN_OBJECTS:
        return KNOWN_OBJECTS[query_lower]

    # Check solar system
    if query_lower in SOLAR_SYSTEM:
        return SOLAR_SYSTEM[query_lower]

    # Partial match in known objects
    for key, obj in KNOWN_OBJECTS.items():
        if query_lower in key or key in query_lower:
            return obj

    # Check cache
    cache_key = f"simbad:{query_lower}"
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    # SIMBAD TAP query
    adql_query = f"""
        SELECT TOP 1
            main_id, otype, ra, dec,
            plx_value,
            sp_type
        FROM basic
        JOIN ident ON ident.oidref = basic.oid
        WHERE LOWER(ident.id) LIKE '%{query_lower}%'
        ORDER BY main_id
    """

    params = {
        "REQUEST": "doQuery",
        "LANG": "ADQL",
        "QUERY": adql_query,
        "FORMAT": "json",
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        try:
            resp = await client.get(SIMBAD_TAP, params=params)
            if resp.status_code != 200:
                return None
            data = resp.json()
        except Exception:
            return None

    rows = data.get("data", [])
    cols = data.get("metadata", [])
    if not rows or not cols:
        return None

    # Parse column names
    col_names = [c.get("name", "").lower() for c in cols]

    def get_val(row: list, col: str) -> Any:
        try:
            idx = col_names.index(col)
            return row[idx]
        except ValueError:
            return None

    row = rows[0]
    main_id = get_val(row, "main_id") or query
    otype = get_val(row, "otype") or "star"
    ra = get_val(row, "ra")
    dec = get_val(row, "dec")
    plx = get_val(row, "plx_value")  # parallax in mas
    sp_type = get_val(row, "sp_type")

    # Convert parallax to distance
    dist_ly = None
    if plx and plx > 0:
        dist_parsec = 1000.0 / plx
        dist_ly = dist_parsec * 3.26156

    # Map SIMBAD object type to our type
    obj_type = _map_simbad_type(otype)

    result = _build_simbad_response(main_id, obj_type, ra, dec, dist_ly, sp_type)
    _set_cached(cache_key, result)
    return result


def _map_simbad_type(simbad_type: str) -> str:
    """Map SIMBAD object type codes to our simplified types."""
    if not simbad_type:
        return "star"
    t = simbad_type.lower()
    if any(x in t for x in ["galaxy", "g ", "gal", "agn", "qso"]):
        return "galaxy"
    if any(x in t for x in ["nebula", "neb", "snr", "pn", "ism"]):
        return "nebula"
    if any(x in t for x in ["star cluster", "cl ", "association"]):
        return "nebula"  # treat as nebula-like for visual
    return "star"


def _build_simbad_response(
    name: str,
    obj_type: str,
    ra: Optional[float],
    dec: Optional[float],
    dist_ly: Optional[float],
    sp_type: Optional[str],
) -> CelestialObject:
    """Build a CelestialObject from SIMBAD data."""
    if obj_type == "star" and sp_type:
        return StarResponse(
            id=name.lower().replace(" ", "_").replace("+", "p"),
            name=name,
            type="star",
            ra=ra,
            dec=dec,
            distance_ly=dist_ly,
            description=f"A {sp_type or 'main sequence'} star in the Milky Way.",
            star=StarData(spectral_type=sp_type),
        )

    return CelestialObject(
        id=name.lower().replace(" ", "_").replace("+", "p"),
        name=name,
        type=obj_type,
        ra=ra,
        dec=dec,
        distance_ly=dist_ly,
        description=f"A {obj_type} discovered through deep-sky surveys.",
    )


def get_popular_objects() -> List[CelestialObject]:
    """Return the curated list of popular objects for the observatory panel."""
    popular_keys = [
        "andromeda",
        "orion nebula",
        "vega",
        "sirius",
        "betelgeuse",
        "horsehead nebula",
        "crab nebula",
        "pleiades",
    ]
    solar_keys = ["mars", "jupiter", "saturn", "neptune"]

    results = [KNOWN_OBJECTS[k] for k in popular_keys if k in KNOWN_OBJECTS]
    results += [SOLAR_SYSTEM[k] for k in solar_keys if k in SOLAR_SYSTEM]
    return results
