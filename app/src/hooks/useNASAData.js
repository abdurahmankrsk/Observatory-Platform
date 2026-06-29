'use client'

/**
 * useNASAData — React Query hooks for all NASA/SIMBAD API calls.
 * All calls go through our FastAPI backend proxy.
 */
import { useQuery, useMutation } from '@tanstack/react-query'
import axios from 'axios'

// Frontend and API share the same Next.js origin — no base URL needed.
const api = axios.create({
  baseURL: '',
  timeout: 15000,
})

// ── Search ────────────────────────────────────────────────────────────────

export function useSearch(query) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: async () => {
      if (!query || query.trim().length < 1) return { results: [], total: 0, query: '' }
      const { data } = await api.get('/api/search', { params: { q: query } })
      return data
    },
    enabled: !!query && query.trim().length >= 1,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

// ── Popular objects ────────────────────────────────────────────────────────

export function usePopularObjects() {
  return useQuery({
    queryKey: ['popular'],
    queryFn: async () => {
      const { data } = await api.get('/api/popular')
      return data
    },
    staleTime: 1000 * 60 * 30, // 30 minutes — popular list rarely changes
  })
}

// ── Free-text translation (object description / fun fact) ───────────────────

/**
 * Translate an object's free-text fields (description, fun_fact) to `lang` via
 * the backend /api/translate proxy. No-op for English: returns the originals and
 * makes no request. Fails open — if translation errors, the original text shows.
 * Cached per (lang, object id); the backend caches per string on top of that.
 */
export function useTranslatedObject(object, lang) {
  const texts = []
  if (object?.description) texts.push(object.description)
  if (object?.fun_fact) texts.push(object.fun_fact)

  const enabled = !!lang && lang !== 'en' && texts.length > 0

  const { data } = useQuery({
    queryKey: ['translate', lang, object?.id],
    queryFn: async () => {
      const { data } = await api.post('/api/translate', {
        texts,
        target: lang,
        source: 'en',
      })
      return data.translations || {}
    },
    enabled,
    staleTime: Infinity,
    retry: 1,
  })

  const map = data || {}
  const pick = (s) => (s ? map[s] || s : s)
  return { description: pick(object?.description), fun_fact: pick(object?.fun_fact) }
}

// ── Exoplanets ─────────────────────────────────────────────────────────────

export function useExoplanets(limit = 50, habitable = false) {
  return useQuery({
    queryKey: ['exoplanets', limit, habitable],
    queryFn: async () => {
      const { data } = await api.get('/api/exoplanets', {
        params: { limit, habitable },
      })
      return data
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  })
}

// ── Today's asteroids ──────────────────────────────────────────────────────

export function useTodayAsteroids() {
  return useQuery({
    queryKey: ['asteroids', 'today'],
    queryFn: async () => {
      const { data } = await api.get('/api/asteroids/today')
      return data
    },
    staleTime: 1000 * 60 * 60, // 1 hour — asteroid approaches don't change intra-day
  })
}

// ── Object by ID ───────────────────────────────────────────────────────────

export function useObject(id) {
  return useQuery({
    queryKey: ['object', id],
    queryFn: async () => {
      const { data } = await api.get(`/api/object/${id}`)
      return data
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 30,
  })
}

// ── Search mutation (imperative, for use in search panel) ──────────────────

export function useSearchMutation() {
  return useMutation({
    // Accepts { query, signal }. The AbortSignal lets the caller cancel an
    // in-flight request when the user edits the query (so a slow SIMBAD lookup
    // doesn't land stale results after the text has changed).
    mutationFn: async ({ query, signal }) => {
      // A live SIMBAD lookup for an object not in the hardcoded list can take
      // longer than the shared 15s axios default, so allow up to 25s (matching
      // the backend's headroom) to avoid the client aborting a valid search.
      const { data } = await api.get('/api/search', {
        params: { q: query },
        timeout: 25000,
        signal,
      })
      return data
    },
  })
}

// ── Identify by coordinates (imperative, for the coordinate input panel) ────

export function useIdentifyMutation() {
  return useMutation({
    mutationFn: async ({ ra, dec, radius = 0.1 }) => {
      // Longer per-request timeout: a live cone search can outlast the
      // shared 15s axios default.
      const { data } = await api.get('/api/identify', {
        params: { ra, dec, radius },
        timeout: 25000,
      })
      return data
    },
  })
}
