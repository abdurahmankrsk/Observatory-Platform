/**
 * Shared type definitions for celestial-object payloads.
 *
 * JSDoc port of backend/models/schemas.py — referenced across the API routes
 * and services via `import('../types/astronomy.js').<Type>`. This module exists
 * purely for editor/type tooling; it emits no runtime code.
 */

/**
 * Base shape for any celestial object returned by the API.
 * @typedef {Object} CelestialObject
 * @property {string} id
 * @property {string} name
 * @property {string} type            'planet' | 'exoplanet' | 'asteroid' | 'star' | 'nebula' | 'galaxy' | 'moon' | 'blackhole'
 * @property {string|null} [otype]    Raw catalog object-type code (SIMBAD), e.g. 'Psr', 'SNR', 'QSO'
 * @property {number|null} [ra]       Right Ascension in degrees
 * @property {number|null} [dec]      Declination in degrees
 * @property {number|null} [distance_ly]
 * @property {number|null} [distance_au]
 * @property {string|null} [description]
 * @property {string|null} [fun_fact]
 */

/**
 * Exoplanet-specific physical parameters.
 * @typedef {Object} ExoplanetData
 * @property {number|null} [radius_earth]
 * @property {number|null} [mass_earth]
 * @property {number|null} [orbital_period_days]
 * @property {number|null} [semi_major_axis_au]
 * @property {number|null} [star_temperature_k]
 * @property {number|null} [star_radius_solar]
 * @property {number|null} [equilibrium_temp_k]
 * @property {boolean} is_habitable
 */

/**
 * @typedef {CelestialObject & { exoplanet?: ExoplanetData|null }} ExoplanetResponse
 */

/**
 * Close-approach data for an asteroid.
 * @typedef {Object} AsteroidCloseApproach
 * @property {string} date
 * @property {number} relative_velocity_km_s
 * @property {number} miss_distance_km
 * @property {number} miss_distance_au
 */

/**
 * Asteroid-specific parameters.
 * @typedef {Object} AsteroidData
 * @property {number|null} [diameter_min_km]
 * @property {number|null} [diameter_max_km]
 * @property {boolean} is_potentially_hazardous
 * @property {number|null} [absolute_magnitude]
 */

/**
 * @typedef {CelestialObject & { asteroid?: AsteroidData|null, close_approach?: AsteroidCloseApproach|null }} AsteroidResponse
 */

/**
 * Star-specific physical parameters.
 * @typedef {Object} StarData
 * @property {number|null} [temperature_k]
 * @property {number|null} [radius_solar]
 * @property {number|null} [luminosity_solar]
 * @property {string|null} [spectral_type]
 */

/**
 * @typedef {CelestialObject & { star?: StarData|null }} StarResponse
 */

export {}
