/**
 * Simple in-memory TTL cache shared across all server-side services.
 * Key → { data, timestamp }
 *
 * Next.js runs API routes in a Node.js process, so a module-level Map
 * persists across requests (just like the Python dict did).
 */

/** @type {Map<string, { data: any, ts: number }>} */
const _cache = new Map()

/**
 * Retrieve a cached value if still within TTL, otherwise null.
 * @param {string} key
 * @param {number} ttlSeconds
 * @returns {any|null}
 */
export function getCache(key, ttlSeconds) {
  const entry = _cache.get(key)
  if (!entry) return null
  if (Date.now() / 1000 - entry.ts < ttlSeconds) return entry.data
  _cache.delete(key)
  return null
}

/**
 * Store a value in the cache.
 * @param {string} key
 * @param {any} data
 */
export function setCache(key, data) {
  _cache.set(key, { data, ts: Date.now() / 1000 })
}
