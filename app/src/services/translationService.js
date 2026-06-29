/**
 * Translation service — free machine translation for object descriptions / fun facts.
 *
 * Provider is selectable via the TRANSLATE_PROVIDER env var:
 *   - "mymemory" (default) — https://mymemory.translated.net, no API key.
 *     Anonymous quota ~5k words/day; set MYMEMORY_EMAIL to raise it to ~50k/day.
 *   - "lingva"             — a Lingva Translate instance (Google-backed). Set
 *     LINGVA_URL to your instance (default https://lingva.ml).
 *
 * Fails OPEN: any error/timeout returns the ORIGINAL text so the UI never breaks.
 * Results are cached in-memory (text+target → translation) for 30 days.
 * No-op when the target language is English / equals the source.
 *
 * Port of backend/services/translation_service.py
 */

import { getCache, setCache } from './cache.js'

const CACHE_TTL = 60 * 60 * 24 * 30 // 30 days — translations are stable
const MAX_LEN = 500                   // MyMemory rejects a single q > ~500 bytes

// Cap concurrent upstream calls via a simple promise semaphore
const CONCURRENCY_LIMIT = 5
let _activeRequests = 0
const _waitQueue = []

function _acquireSemaphore() {
  if (_activeRequests < CONCURRENCY_LIMIT) {
    _activeRequests++
    return Promise.resolve()
  }
  return new Promise((resolve) => _waitQueue.push(resolve))
}

function _releaseSemaphore() {
  _activeRequests--
  if (_waitQueue.length > 0) {
    _activeRequests++
    _waitQueue.shift()()
  }
}

function _provider() {
  return (process.env.TRANSLATE_PROVIDER ?? 'mymemory').toLowerCase()
}

function _cacheKey(text, target, source) {
  return `${_provider()}:${source}|${target}:${text}`
}

/**
 * @param {string} text
 * @param {string} source
 * @param {string} target
 * @returns {Promise<string>}
 */
async function _mymemory(text, source, target) {
  const params = new URLSearchParams({
    q: text,
    langpair: `${source}|${target}`,
  })
  const email = process.env.MYMEMORY_EMAIL
  if (email) params.set('de', email)

  const resp = await fetch(
    `https://api.mymemory.translated.net/get?${params}`,
    { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'AstroObservatory/1.0' } }
  )
  if (!resp.ok) return text

  const data = await resp.json()
  const translated = data?.responseData?.translatedText ?? ''
  if (!translated || translated.toUpperCase().includes('MYMEMORY WARNING')) return text
  return translated
}

/**
 * @param {string} text
 * @param {string} source
 * @param {string} target
 * @returns {Promise<string>}
 */
async function _lingva(text, source, target) {
  const base = (process.env.LINGVA_URL ?? 'https://lingva.ml').replace(/\/$/, '')
  const encoded = encodeURIComponent(text)
  const resp = await fetch(
    `${base}/api/v1/${source}/${target}/${encoded}`,
    { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'AstroObservatory/1.0' } }
  )
  if (!resp.ok) return text
  const data = await resp.json()
  return data?.translation ?? text
}

/**
 * Translate a single string, with caching and semaphore.
 * @param {string} text
 * @param {string} source
 * @param {string} target
 * @returns {Promise<string>}
 */
async function _translateOne(text, source, target) {
  const trimmed = (text ?? '').trim()
  if (!trimmed || trimmed.length > MAX_LEN) return trimmed

  const key = _cacheKey(trimmed, target, source)
  const hit = getCache(key, CACHE_TTL)
  if (hit !== null) return hit

  await _acquireSemaphore()
  let out = trimmed
  try {
    if (_provider() === 'lingva') {
      out = await _lingva(trimmed, source, target)
    } else {
      out = await _mymemory(trimmed, source, target)
    }
  } catch {
    out = trimmed // fail open
  } finally {
    _releaseSemaphore()
  }

  setCache(key, out)
  return out
}

/**
 * Translate many strings at once. Returns an { original: translated } map.
 * De-duplicates inputs and translates concurrently. A no-op (identity map) when
 * the target equals the source or is English.
 * @param {string[]} texts
 * @param {string} target
 * @param {string} [source='en']
 * @returns {Promise<Record<string, string>>}
 */
export async function translateBatch(texts, target, source = 'en') {
  const uniq = [...new Set(texts.map((t) => (t ?? '').trim()).filter(Boolean))]
  if (!uniq.length || target === source || target === 'en') {
    return Object.fromEntries(uniq.map((t) => [t, t]))
  }

  const translated = await Promise.all(
    uniq.map((t) => _translateOne(t, source, target))
  )
  return Object.fromEntries(uniq.map((t, i) => [t, translated[i]]))
}
