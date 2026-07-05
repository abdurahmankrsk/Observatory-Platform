/**
 * Lightweight in-memory per-IP rate limiter for the public /api routes.
 *
 * Threat model: the API is unauthenticated and proxies to NASA/SIMBAD/MyMemory,
 * so a single script can fire thousands of requests and burn upstream quota and
 * Vercel function time ("denial-of-wallet"). This blunts that without getting in
 * a real user's way (a human clicking around stays well under the limit).
 *
 * Caveat: state is per server instance (module-level Map, same as cache.js), so
 * across many Vercel instances the effective limit is higher. For hard limits,
 * pair this with Vercel's Firewall / rate-limiting. This is defense-in-depth.
 */
import { NextResponse } from 'next/server'

const WINDOW_MS = 60_000 // 1 minute fixed window
const MAX_REQUESTS = 60 // per IP per window — generous for humans, harsh for scripts

/** @type {Map<string, { count: number, resetAt: number }>} */
const _hits = new Map()

function clientIp(request) {
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return request.headers.get('x-real-ip') || 'unknown'
}

/**
 * Returns a 429 NextResponse if the caller is over the limit, otherwise null.
 * @param {Request} request
 * @param {{ windowMs?: number, max?: number }} [opts]
 * @returns {import('next/server').NextResponse|null}
 */
export function rateLimit(request, { windowMs = WINDOW_MS, max = MAX_REQUESTS } = {}) {
  // Disable rate limiting during local development to prevent silent API failures
  if (process.env.NODE_ENV === 'development') return null;

  const ip = clientIp(request)
  const now = Date.now()

  let entry = _hits.get(ip)
  if (!entry || now > entry.resetAt) {
    // New window. Opportunistically sweep expired entries so the Map can't grow
    // unbounded across many unique IPs.
    if (_hits.size > 5000) {
      for (const [k, v] of _hits) if (now > v.resetAt) _hits.delete(k)
    }
    entry = { count: 0, resetAt: now + windowMs }
    _hits.set(ip, entry)
  }

  entry.count++
  if (entry.count > max) {
    const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000))
    return NextResponse.json(
      { error: 'Too Many Requests', detail: 'Rate limit exceeded — slow down.', code: 429 },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }
  return null
}

/**
 * Wrap a route handler so it's rate-limited per IP. Passes through all handler
 * args (including the `{ params }` context for dynamic routes).
 * @template {(...args: any[]) => any} H
 * @param {H} handler
 * @param {{ windowMs?: number, max?: number }} [opts]
 * @returns {H}
 */
export function withRateLimit(handler, opts) {
  return /** @type {H} */ (
    async (request, ...rest) => {
      const limited = rateLimit(request, opts)
      if (limited) return limited
      return handler(request, ...rest)
    }
  )
}
