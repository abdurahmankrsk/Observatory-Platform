'use client'

/**
 * Astronomy math utilities
 * - RA/Dec → Cartesian coordinate conversion
 * - Kepler's equation solver (Newton-Raphson)
 * - Keplerian orbital elements → 3D position
 * - Unit conversions
 */
import * as THREE from 'three'

/**
 * Convert Right Ascension / Declination to 3D Cartesian coordinates.
 * @param {number} ra  - Right Ascension in degrees (0–360)
 * @param {number} dec - Declination in degrees (-90 to +90)
 * @param {number} distance - Distance (any unit, same unit as output)
 * @returns {{ x: number, y: number, z: number }}
 */
export function raDecToCartesian(ra, dec, distance = 1) {
  const raRad = (ra * Math.PI) / 180
  const decRad = (dec * Math.PI) / 180
  return {
    x: distance * Math.cos(decRad) * Math.cos(raRad),
    y: distance * Math.sin(decRad),
    z: distance * Math.cos(decRad) * Math.sin(raRad),
  }
}

/**
 * Convert RA/Dec to THREE.Vector3 (useful for R3F direct positioning).
 */
export function raDecToVector3(ra, dec, distance = 1) {
  const { x, y, z } = raDecToCartesian(ra, dec, distance)
  return new THREE.Vector3(x, y, z)
}

/**
 * Solve Kepler's equation M = E - e*sin(E) using Newton-Raphson iteration.
 * @param {number} M - Mean anomaly (radians)
 * @param {number} e - Orbital eccentricity (0–1 for elliptic)
 * @param {number} tolerance - Convergence threshold
 * @returns {number} Eccentric anomaly E (radians)
 */
export function solveKeplerEquation(M, e, tolerance = 1e-8) {
  let E = M // initial guess
  for (let i = 0; i < 100; i++) {
    const dE = (M - E + e * Math.sin(E)) / (1 - e * Math.cos(E))
    E += dE
    if (Math.abs(dE) < tolerance) break
  }
  return E
}

/**
 * Convert Keplerian orbital elements to 3D Cartesian position (AU).
 * @param {number} a     - Semi-major axis (AU)
 * @param {number} e     - Eccentricity
 * @param {number} i     - Inclination (degrees)
 * @param {number} omega - Argument of periapsis (degrees)
 * @param {number} Omega - Longitude of ascending node (degrees)
 * @param {number} M     - Mean anomaly (degrees)
 * @returns {THREE.Vector3} Position in AU
 */
export function keplerianToCartesian(a, e, i, omega, Omega, M) {
  const toRad = (d) => (d * Math.PI) / 180

  // Solve Kepler's equation for eccentric anomaly
  const E = solveKeplerEquation(toRad(M), e)

  // True anomaly
  const nu =
    2 *
    Math.atan2(
      Math.sqrt(1 + e) * Math.sin(E / 2),
      Math.sqrt(1 - e) * Math.cos(E / 2)
    )

  // Distance from focus
  const r = a * (1 - e * Math.cos(E))

  // Perifocal coordinates
  const x_peri = r * Math.cos(nu)
  const y_peri = r * Math.sin(nu)

  // Rotation matrices
  const cosO = Math.cos(toRad(Omega))
  const sinO = Math.sin(toRad(Omega))
  const cosi = Math.cos(toRad(i))
  const sini = Math.sin(toRad(i))
  const cosw = Math.cos(toRad(omega))
  const sinw = Math.sin(toRad(omega))

  // Transform to ecliptic/equatorial
  const x =
    (cosO * cosw - sinO * sinw * cosi) * x_peri +
    (-cosO * sinw - sinO * cosw * cosi) * y_peri

  const y =
    (sinO * cosw + cosO * sinw * cosi) * x_peri +
    (-sinO * sinw + cosO * cosw * cosi) * y_peri

  const z = (sinw * sini) * x_peri + (cosw * sini) * y_peri

  return new THREE.Vector3(x, y, z)
}

/**
 * Generate points along a Keplerian elliptical orbit.
 * @param {number} a  - Semi-major axis
 * @param {number} e  - Eccentricity
 * @param {number} i  - Inclination (degrees)
 * @param {number} omega - Argument of periapsis (degrees)
 * @param {number} Omega - Longitude of ascending node (degrees)
 * @param {number} segments - Number of points
 * @returns {THREE.Vector3[]}
 */
export function generateOrbitPoints(a, e, i, omega, Omega, segments = 128) {
  const points = []
  for (let k = 0; k <= segments; k++) {
    const M = (k / segments) * 360
    const pos = keplerianToCartesian(a, e, i, omega, Omega, M)
    points.push(pos)
  }
  return points
}

// ── Unit Conversions ──────────────────────────────────────────────────────

/** 1 light-year = 63,241 AU */
export const LY_TO_AU = 63241

/** 1 AU = 1/63241 light-years */
export const AU_TO_LY = 1 / LY_TO_AU

/** 1 parsec = 3.26156 light-years */
export const PC_TO_LY = 3.26156

export const lightYearsToParsecs = (ly) => ly / PC_TO_LY
export const parsecsToLightYears = (pc) => pc * PC_TO_LY
export const auToLightYears = (au) => au * AU_TO_LY
export const lightYearsToAU = (ly) => ly * LY_TO_AU

/**
 * Format distance for human display.
 * Automatically picks the best unit.
 */
export function formatDistance(object) {
  if (object.distance_ly != null) {
    const ly = object.distance_ly
    if (ly >= 1e6) return `${(ly / 1e6).toFixed(2)}M ly`
    if (ly >= 1000) return `${(ly / 1000).toFixed(2)}K ly`
    if (ly >= 1) return `${ly.toFixed(2)} ly`
    return `${(ly * LY_TO_AU).toFixed(2)} AU`
  }
  if (object.distance_au != null) {
    const au = object.distance_au
    if (au >= 1) return `${au.toFixed(3)} AU`
    return `${(au * 149597870.7).toFixed(0)} km`
  }
  return 'Unknown distance'
}

/**
 * Compute a display scale for objects in the 3D scene.
 * Larger objects get a larger scene radius, clamped for usability.
 */
export function computeSceneRadius(object) {
  if (!object) return 1
  const type = object.type

  if (type === 'galaxy') return 8
  if (type === 'nebula') return 6
  if (type === 'star') {
    const solarRadii = object.star?.radius_solar ?? 1
    return Math.min(Math.max(solarRadii * 0.3, 0.5), 5)
  }
  if (type === 'exoplanet') {
    const earthRadii = object.exoplanet?.radius_earth ?? 1
    return Math.min(Math.max(earthRadii * 0.3, 0.4), 3)
  }
  if (type === 'planet') return 1.5
  if (type === 'asteroid') return 0.3

  return 1
}
