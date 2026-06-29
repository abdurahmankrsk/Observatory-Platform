/**
 * NASA API Service — calls to NASA Exoplanet Archive and NeoWs.
 * All results are cached in-memory to avoid hitting rate limits.
 *
 * Port of backend/services/nasa_service.py
 */

import { getCache, setCache } from './cache.js'

const CACHE_TTL = 3600 // 1 hour

// NASA Exoplanet Archive TAP endpoint
const EXOPLANET_BASE = 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync'

// NASA NeoWs (Near Earth Objects)
const NEOWS_BASE = 'https://api.nasa.gov/neo/rest/v1'

// ── Exoplanets ──────────────────────────────────────────────────────────────

/**
 * Query the NASA Exoplanet Archive for confirmed exoplanets.
 * @param {number} limit
 * @param {boolean} habitableOnly
 * @param {string} apiKey
 * @returns {Promise<import('../types/astronomy.js').ExoplanetResponse[]>}
 */
export async function fetchExoplanets(limit = 50, habitableOnly = false, apiKey = 'DEMO_KEY') {
  const cacheKey = `exoplanets:${limit}:${habitableOnly}`
  const cached = getCache(cacheKey, CACHE_TTL)
  if (cached !== null) return cached

  let whereClause
  if (habitableOnly) {
    whereClause =
      'default_flag=1 AND pl_rade IS NOT NULL ' +
      'AND pl_rade < 2.0 AND pl_rade > 0.5 ' +
      'AND pl_eqt IS NOT NULL AND pl_eqt > 200 AND pl_eqt < 350'
  } else {
    whereClause = 'default_flag=1 AND pl_rade IS NOT NULL'
  }

  const query =
    `SELECT TOP ${limit} pl_name, pl_rade, pl_masse, pl_orbper, pl_orbsmax, ` +
    `st_teff, st_rad, sy_dist, ra, dec, pl_eqt ` +
    `FROM ps WHERE ${whereClause} ` +
    `ORDER BY sy_dist ASC`

  const url = new URL(EXOPLANET_BASE)
  url.searchParams.set('query', query)
  url.searchParams.set('format', 'json')

  let rawData
  try {
    const resp = await fetch(url.toString(), { signal: AbortSignal.timeout(30000) })
    if (!resp.ok) throw new Error(`NASA Exoplanet Archive returned ${resp.status}`)
    rawData = await resp.json()
  } catch (err) {
    if (err.name === 'TimeoutError') throw new Error('NASA Exoplanet Archive timed out')
    throw new Error(`NASA Exoplanet Archive error: ${err.message}`)
  }

  const results = rawData.map((row) => {
    const distParsec = row.sy_dist ?? null
    const distLy = distParsec !== null ? distParsec * 3.26156 : null
    const radius = row.pl_rade ?? null
    const eqTemp = row.pl_eqt ?? null
    const starTemp = row.st_teff ?? null

    const isHabitable =
      eqTemp !== null && eqTemp >= 200 && eqTemp <= 350 &&
      radius !== null && radius >= 0.5 && radius <= 2.0

    /** @type {import('../types/astronomy.js').ExoplanetData} */
    const exoData = {
      radius_earth: radius,
      mass_earth: row.pl_masse ?? null,
      orbital_period_days: row.pl_orbper ?? null,
      semi_major_axis_au: row.pl_orbsmax ?? null,
      star_temperature_k: starTemp,
      star_radius_solar: row.st_rad ?? null,
      equilibrium_temp_k: eqTemp,
      is_habitable: isHabitable,
    }

    const name = row.pl_name ?? 'Unknown'
    return {
      id: name.toLowerCase().replace(/ /g, '_').replace(/-/g, '_'),
      name,
      type: 'exoplanet',
      ra: row.ra ?? null,
      dec: row.dec ?? null,
      distance_ly: distLy,
      description: _describeExoplanet(exoData),
      exoplanet: exoData,
    }
  })

  setCache(cacheKey, results)
  return results
}

/**
 * Fetch a single exoplanet by name.
 * @param {string} name
 * @param {string} apiKey
 * @returns {Promise<import('../types/astronomy.js').ExoplanetResponse|null>}
 */
export async function fetchExoplanetByName(name, apiKey = 'DEMO_KEY') {
  // Try the cached full list first
  const allPlanets = await fetchExoplanets(500, false, apiKey)
  const nameLower = name.toLowerCase().trim()
  for (const planet of allPlanets) {
    if (
      planet.name.toLowerCase() === nameLower ||
      planet.id === nameLower.replace(/ /g, '_')
    ) {
      return planet
    }
  }

  // Direct query fallback
  const query =
    `SELECT TOP 1 pl_name, pl_rade, pl_masse, pl_orbper, pl_orbsmax, ` +
    `st_teff, st_rad, sy_dist, ra, dec, pl_eqt ` +
    `FROM ps WHERE default_flag=1 AND LOWER(pl_name) LIKE '%${nameLower}%'`

  const url = new URL(EXOPLANET_BASE)
  url.searchParams.set('query', query)
  url.searchParams.set('format', 'json')

  try {
    const resp = await fetch(url.toString(), { signal: AbortSignal.timeout(30000) })
    if (!resp.ok) return null
    const rawData = await resp.json()
    if (!rawData.length) return null
    return _buildExoplanetFromRow(rawData[0])
  } catch {
    return null
  }
}

/**
 * Find a confirmed exoplanet whose host star lies within radiusDeg of the given coords.
 * @param {number} ra
 * @param {number} dec
 * @param {number} radiusDeg
 * @param {string} apiKey
 * @returns {Promise<import('../types/astronomy.js').ExoplanetResponse|null>}
 */
export async function fetchExoplanetByCoordinates(ra, dec, radiusDeg = 0.05, apiKey = 'DEMO_KEY') {
  const cacheKey = `exo_coord:${ra.toFixed(3)}:${dec.toFixed(3)}:${radiusDeg}`
  const cached = getCache(cacheKey, CACHE_TTL)
  if (cached !== null) return cached

  const query =
    `SELECT TOP 1 pl_name, pl_rade, pl_masse, pl_orbper, pl_orbsmax, ` +
    `st_teff, st_rad, sy_dist, ra, dec, pl_eqt ` +
    `FROM ps WHERE default_flag=1 ` +
    `AND CONTAINS(POINT('ICRS', ra, dec), CIRCLE('ICRS', ${ra}, ${dec}, ${radiusDeg})) = 1`

  const url = new URL(EXOPLANET_BASE)
  url.searchParams.set('query', query)
  url.searchParams.set('format', 'json')

  try {
    const resp = await fetch(url.toString(), { signal: AbortSignal.timeout(30000) })
    if (!resp.ok) return null
    const rawData = await resp.json()
    if (!rawData.length) return null
    const result = _buildExoplanetFromRow(rawData[0])
    setCache(cacheKey, result)
    return result
  } catch {
    return null
  }
}

// ── Asteroids ───────────────────────────────────────────────────────────────

/**
 * Fetch near-Earth asteroids from NASA NeoWs API.
 * @param {string} startDate  YYYY-MM-DD
 * @param {string} endDate    YYYY-MM-DD
 * @param {string} apiKey
 * @returns {Promise<import('../types/astronomy.js').AsteroidResponse[]>}
 */
export async function fetchNearEarthAsteroids(startDate, endDate, apiKey = 'DEMO_KEY') {
  const cacheKey = `asteroids:${startDate}:${endDate}`
  const cached = getCache(cacheKey, CACHE_TTL)
  if (cached !== null) return cached

  const url = new URL(`${NEOWS_BASE}/feed`)
  url.searchParams.set('start_date', startDate)
  url.searchParams.set('end_date', endDate)
  url.searchParams.set('api_key', apiKey)

  let data
  try {
    const resp = await fetch(url.toString(), { signal: AbortSignal.timeout(30000) })
    if (!resp.ok) throw new Error(`NASA NeoWs returned ${resp.status}`)
    data = await resp.json()
  } catch (err) {
    if (err.name === 'TimeoutError') throw new Error('NASA NeoWs timed out')
    throw new Error(`NASA NeoWs error: ${err.message}`)
  }

  /** @type {import('../types/astronomy.js').AsteroidResponse[]} */
  const results = []
  const nearEarthObjects = data.near_earth_objects ?? {}

  for (const [dateKey, asteroidList] of Object.entries(nearEarthObjects)) {
    for (const ast of asteroidList) {
      const name = (ast.name ?? 'Unknown').replace(/^[()]+|[()]+$/g, '').trim()
      const diameterData = ast.estimated_diameter?.kilometers ?? {}
      const closeApproaches = ast.close_approach_data ?? []

      let approach = null
      if (closeApproaches.length > 0) {
        const ca = closeApproaches[0]
        approach = {
          date: ca.close_approach_date ?? dateKey,
          relative_velocity_km_s: parseFloat(ca.relative_velocity?.kilometers_per_second ?? 0),
          miss_distance_km: parseFloat(ca.miss_distance?.kilometers ?? 0),
          miss_distance_au: parseFloat(ca.miss_distance?.astronomical ?? 0),
        }
      }

      const asteroidData = {
        diameter_min_km: diameterData.estimated_diameter_min ?? null,
        diameter_max_km: diameterData.estimated_diameter_max ?? null,
        is_potentially_hazardous: ast.is_potentially_hazardous_asteroid ?? false,
        absolute_magnitude: ast.absolute_magnitude_h ?? null,
      }

      results.push({
        id: String(ast.id ?? name.toLowerCase().replace(/ /g, '_')),
        name,
        type: 'asteroid',
        distance_au: approach?.miss_distance_au ?? null,
        description: `Near-Earth asteroid making a close approach on ${dateKey}.`,
        asteroid: asteroidData,
        close_approach: approach,
      })
    }
  }

  setCache(cacheKey, results)
  return results
}

// ── Private helpers ─────────────────────────────────────────────────────────

/**
 * Build an ExoplanetResponse from a single NASA Exoplanet Archive `ps` row.
 * @param {Record<string, any>} row
 * @returns {import('../types/astronomy.js').ExoplanetResponse}
 */
function _buildExoplanetFromRow(row) {
  const name = row.pl_name ?? 'Unknown'
  const distParsec = row.sy_dist ?? null
  const distLy = distParsec !== null ? distParsec * 3.26156 : null

  const exoData = {
    radius_earth: row.pl_rade ?? null,
    mass_earth: row.pl_masse ?? null,
    orbital_period_days: row.pl_orbper ?? null,
    semi_major_axis_au: row.pl_orbsmax ?? null,
    star_temperature_k: row.st_teff ?? null,
    star_radius_solar: row.st_rad ?? null,
    equilibrium_temp_k: row.pl_eqt ?? null,
    is_habitable: false,
  }

  return {
    id: name.toLowerCase().replace(/ /g, '_').replace(/-/g, '_'),
    name,
    type: 'exoplanet',
    ra: row.ra ?? null,
    dec: row.dec ?? null,
    distance_ly: distLy,
    description: _describeExoplanet(exoData),
    exoplanet: exoData,
  }
}

/**
 * Generate a human-readable description for an exoplanet.
 * @param {import('../types/astronomy.js').ExoplanetData} data
 * @returns {string}
 */
function _describeExoplanet(data) {
  const parts = []

  if (data.radius_earth !== null) {
    if (data.radius_earth < 0.8) parts.push('a sub-Earth sized world')
    else if (data.radius_earth <= 1.5) parts.push('an Earth-sized rocky world')
    else if (data.radius_earth <= 4.0) parts.push('a super-Earth or mini-Neptune')
    else parts.push('a gas giant')
  }

  if (data.equilibrium_temp_k !== null) {
    const temp = data.equilibrium_temp_k
    if (temp < 200) parts.push('with a frigid frozen surface')
    else if (temp <= 350) parts.push('potentially in the habitable zone')
    else if (temp <= 700) parts.push('too hot for liquid water')
    else parts.push('with a scorching hot surface')
  }

  if (data.star_temperature_k !== null) {
    parts.push(`orbiting a star at ${Math.round(data.star_temperature_k)}K`)
  }

  if (!parts.length) return 'An exoplanet beyond our solar system.'
  const joined = parts.join('. It is ')
  return joined.charAt(0).toUpperCase() + joined.slice(1) + '.'
}
