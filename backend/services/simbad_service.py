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


SIMBAD_TAP = "https://simbad.cds.unistra.fr/simbad/sim-tap/sync"

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
    "sagittarius a*": StarResponse(
        id="sagittarius_a_star",
        name="Sagittarius A*",
        type="star",
        otype="BH",  # frontend classifier → BlackHole
        ra=266.41683,
        dec=-29.00781,
        distance_ly=26673,
        description="The supermassive black hole at the centre of the Milky Way, about 4 million times the mass of the Sun.",
        fun_fact="In 2022 the Event Horizon Telescope released the first direct image of Sagittarius A*'s glowing accretion ring.",
    ),
    "sgr a*": StarResponse(
        id="sagittarius_a_star",
        name="Sagittarius A*",
        type="star",
        otype="BH",
        ra=266.41683,
        dec=-29.00781,
        distance_ly=26673,
        description="The supermassive black hole at the centre of the Milky Way, about 4 million times the mass of the Sun.",
        fun_fact="In 2022 the Event Horizon Telescope released the first direct image of Sagittarius A*'s glowing accretion ring.",
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
    "sombrero galaxy": CelestialObject(
        id="sombrero_galaxy",
        name="Sombrero Galaxy (M104)",
        type="galaxy",
        ra=189.9976,
        dec=-11.6231,
        distance_ly=29350000,
        description="A spiral galaxy in Virgo seen nearly edge-on, with a bright bulge and a dramatic dark dust lane that give it the look of a sombrero hat.",
        fun_fact="The Sombrero Galaxy hosts a supermassive black hole of about one billion solar masses at its center — one of the most massive yet measured in a nearby galaxy.",
    ),
    "whirlpool galaxy": CelestialObject(
        id="whirlpool_galaxy",
        name="Whirlpool Galaxy (M51)",
        type="galaxy",
        ra=202.4696,
        dec=47.1952,
        distance_ly=23000000,
        description="A grand-design spiral galaxy in Canes Venatici, interacting with its smaller companion galaxy NGC 5195.",
        fun_fact="The Whirlpool was the first galaxy recognized to have a spiral structure, sketched by Lord Rosse in 1845.",
    ),
    "triangulum galaxy": CelestialObject(
        id="triangulum_galaxy",
        name="Triangulum Galaxy (M33)",
        type="galaxy",
        ra=23.4621,
        dec=30.6602,
        distance_ly=2730000,
        description="The third-largest galaxy in the Local Group, a spiral galaxy in the constellation Triangulum.",
        fun_fact="Under very dark skies, the Triangulum Galaxy is one of the most distant objects visible to the naked eye.",
    ),
    "pinwheel galaxy": CelestialObject(
        id="pinwheel_galaxy",
        name="Pinwheel Galaxy (M101)",
        type="galaxy",
        ra=210.8025,
        dec=54.3491,
        distance_ly=20870000,
        description="A face-on spiral galaxy in Ursa Major, notable for its prominent and well-defined spiral arms.",
        fun_fact="The Pinwheel Galaxy is nearly twice the diameter of the Milky Way, spanning about 170,000 light-years.",
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

    # SIMBAD's ADQL has no LOWER()/UPPER()/ILIKE (they 400), but its `ident`
    # matching already ignores case and internal spacing. So we normalise the
    # user's text to a single-spaced, uppercased catalogue form and match the
    # identifier directly — escaping quotes so a name like "O'Brien" can't break
    # the query. An exact match resolves the object itself (e.g. "ngc 253" → the
    # galaxy, not a sub-source); a prefix match is the fallback for partial typing.
    norm = " ".join(query.upper().split()).replace("'", "''")

    result = await _query_simbad(
        f"""
        SELECT TOP 1 main_id, otype, ra, dec, plx_value, sp_type, nbref
        FROM basic JOIN ident ON ident.oidref = basic.oid
        WHERE ident.id = '{norm}'
        """,
        fallback_name=query,
    )
    if result is None:
        result = await _query_simbad(
            f"""
            SELECT TOP 1 main_id, otype, ra, dec, plx_value, sp_type, nbref
            FROM basic JOIN ident ON ident.oidref = basic.oid
            WHERE ident.id LIKE '{norm}%'
            ORDER BY nbref DESC
            """,
            fallback_name=query,
        )

    if result is not None:
        _set_cached(cache_key, result)
    return result


async def _query_simbad(adql_query: str, fallback_name: str) -> Optional[CelestialObject]:
    """Run an ADQL query against the SIMBAD TAP service and parse its first row."""
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
    return _parse_simbad_rows(data, fallback_name=fallback_name)


def _parse_simbad_rows(data: Dict[str, Any], fallback_name: str) -> Optional[CelestialObject]:
    """Parse a SIMBAD TAP JSON response (first/closest row) into a CelestialObject."""
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
    main_id = get_val(row, "main_id") or fallback_name
    main_id = " ".join(str(main_id).split())  # collapse SIMBAD padding, e.g. "M  31"
    # Drop SIMBAD's "NAME " common-name marker for display, e.g.
    # "NAME 30 Dor Nebula" → "30 Dor Nebula".
    if main_id.upper().startswith("NAME "):
        main_id = main_id[5:]
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

    # Map SIMBAD object type to our coarse visual type, but keep the raw code so
    # the frontend classifier can recover the precise sub-type (pulsar, SNR, …).
    obj_type = _map_simbad_type(otype)

    return _build_simbad_response(main_id, obj_type, ra, dec, dist_ly, sp_type, otype)


async def identify_by_coordinates(
    ra: float, dec: float, radius_deg: float = 0.1
) -> Optional[CelestialObject]:
    """
    Identify the most notable catalogued object near the given sky coordinates
    via a SIMBAD cone search. Ranks by reference count (nbref) so a famous
    object (e.g. M 31) wins over the anonymous point sources that crowd its
    center, with angular distance as the tiebreaker. Returns None if nothing is
    catalogued within the radius. CIRCLE/CONTAINS use true spherical geometry,
    so RA wraparound at 0/360 and the celestial poles are handled correctly.
    """
    cache_key = f"identify:{round(ra, 3)}:{round(dec, 3)}:{radius_deg}"
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    adql_query = f"""
        SELECT TOP 5
            main_id, otype, ra, dec, plx_value, sp_type, nbref,
            DISTANCE(POINT('ICRS', ra, dec), POINT('ICRS', {ra}, {dec})) AS sep
        FROM basic
        WHERE CONTAINS(POINT('ICRS', ra, dec), CIRCLE('ICRS', {ra}, {dec}, {radius_deg})) = 1
          AND ra IS NOT NULL
        ORDER BY nbref DESC, sep ASC
    """

    params = {
        "REQUEST": "doQuery",
        "LANG": "ADQL",
        "QUERY": adql_query,
        "FORMAT": "json",
    }

    # SIMBAD can be slow under load; allow up to 20s (still below the frontend's
    # 25s request timeout, so the client doesn't give up first).
    async with httpx.AsyncClient(timeout=20.0) as client:
        try:
            resp = await client.get(SIMBAD_TAP, params=params)
            if resp.status_code != 200:
                return None
            data = resp.json()
        except Exception:
            return None

    result = _parse_simbad_rows(data, fallback_name=f"Object near {ra:.4f}, {dec:.4f}")
    if result is not None:
        _set_cached(cache_key, result)
    return result


# SIMBAD condensed object-type codes grouped into our three visual buckets.
# (otype_txt returns the same condensed code, so we map the codes directly.)
_GALAXY_OTYPES = {
    "G", "AGN", "SyG", "Sy1", "Sy2", "rG", "LIN", "QSO", "Bla", "BLL",
    "GiG", "GiC", "GiP", "BiC", "ClG", "GrG", "CGG", "PaG", "IG", "SCG",
    "EmG", "SBG", "H2G", "LSB", "bCG", "GlG", "Q?", "AG?",
}
_NEBULA_OTYPES = {
    "ISM", "Cld", "GNe", "BNe", "DNe", "RNe", "MoC", "HII", "SNR", "SR?",
    "PN", "PN?", "EmO", "HH", "sh", "cor", "bub", "SFR", "glb", "CGb",
    "HVC", "out", "flt", "cmb",
    # Star clusters render as nebula-like blobs in this app:
    "Cl*", "GlC", "OpC", "As*", "Cl?", "St*", "MGr",
}


def _map_simbad_type(simbad_type: str) -> str:
    """Map a SIMBAD object-type code to one of our visual types: star/nebula/galaxy."""
    if not simbad_type:
        return "star"
    code = simbad_type.strip()
    if code in _GALAXY_OTYPES:
        return "galaxy"
    if code in _NEBULA_OTYPES:
        return "nebula"
    # Fallback substring match — handles long-form labels and code variants.
    t = code.lower()
    if any(x in t for x in ["galax", "agn", "quasar", "qso"]):
        return "galaxy"
    if any(x in t for x in ["nebula", "cluster", "snr", "ism", "hii"]):
        return "nebula"
    return "star"


# Human-readable phrases for SIMBAD object-type codes. These both feed the
# InfoPanel and act as a redundant signal for the frontend's description parser
# (so even if its otype map misses a code, the words still classify correctly).
_OTYPE_LABELS = {
    "Psr": "pulsar",
    "N*": "neutron star", "NS": "neutron star",
    "BH": "black hole", "bH": "black hole",
    "SNR": "supernova remnant", "SR?": "supernova remnant",
    "PN": "planetary nebula", "PN?": "planetary nebula",
    "GNe": "emission nebula", "BNe": "emission nebula", "HII": "emission nebula", "EmO": "emission nebula",
    "RNe": "reflection nebula",
    "DNe": "dark nebula", "MoC": "dark nebula",
    "GlC": "globular cluster", "OpC": "open cluster", "Cl*": "open cluster",
    "QSO": "quasar", "AGN": "active galactic nucleus", "Bla": "blazar", "BLL": "blazar",
    "WD*": "white dwarf", "BD*": "brown dwarf",
    "Y*O": "protostar", "TTau": "protostar",
    "**": "binary star",
}


def _build_simbad_response(
    name: str,
    obj_type: str,
    ra: Optional[float],
    dec: Optional[float],
    dist_ly: Optional[float],
    sp_type: Optional[str],
    otype: Optional[str] = None,
) -> CelestialObject:
    """Build a CelestialObject from SIMBAD data."""
    code = (otype or "").strip()
    label = _OTYPE_LABELS.get(code)

    if obj_type == "star" and sp_type:
        # Mention the specific kind (pulsar, white dwarf, …) when SIMBAD gives one.
        if label:
            desc = f"A {label} ({sp_type}) catalogued in SIMBAD."
        else:
            desc = f"A {sp_type or 'main sequence'} star in the Milky Way."
        return StarResponse(
            id=name.lower().replace(" ", "_").replace("+", "p"),
            name=name,
            type="star",
            otype=code or None,
            ra=ra,
            dec=dec,
            distance_ly=dist_ly,
            description=desc,
            star=StarData(spectral_type=sp_type),
        )

    described = label or obj_type
    return CelestialObject(
        id=name.lower().replace(" ", "_").replace("+", "p"),
        name=name,
        type=obj_type,
        otype=code or None,
        ra=ra,
        dec=dec,
        distance_ly=dist_ly,
        description=f"A {described} catalogued through deep-sky surveys.",
    )


def get_popular_objects() -> List[CelestialObject]:
    """Return the curated list of popular objects for the observatory panel."""
    popular_keys = [
        "andromeda",
        "orion nebula",
        "vega",
        "sirius",
        "betelgeuse",
        "sagittarius a*",
        "horsehead nebula",
        "crab nebula",
        "pleiades",
    ]
    solar_keys = ["mars", "jupiter", "saturn", "neptune"]

    results = [KNOWN_OBJECTS[k] for k in popular_keys if k in KNOWN_OBJECTS]
    results += [SOLAR_SYSTEM[k] for k in solar_keys if k in SOLAR_SYSTEM]
    return results
