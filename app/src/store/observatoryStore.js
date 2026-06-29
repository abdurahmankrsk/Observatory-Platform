'use client'

/**
 * Zustand global state store — the single source of truth for the entire app.
 * State machine: start → entering → observatory → targeting → flying → viewing
 */
import { create } from 'zustand'

// Saved/favourited objects persist across sessions in localStorage. We store the
// full CelestialObject payload so a saved object can be re-targeted and flown to
// without another backend lookup.
const SAVED_KEY = 'savedObjects'
function loadSavedObjects() {
  try {
    const raw = localStorage.getItem(SAVED_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
function persistSavedObjects(objects) {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(objects)) } catch { /* ignore */ }
}

const useObservatoryStore = create((set, get) => ({
  // ── Scene state machine ─────────────────────────────────────────────────
  scene: 'start',
  // 'start'        — Initial start screen with particle stars
  // 'entering'     — Camera animation flying into observatory
  // 'observatory'  — Inside the observatory, telescope visible
  // 'targeting'    — Telescope animating toward object coords
  // 'flying'       — Warp speed flight through space
  // 'viewing'      — Arrived at object, orbiting, info panel visible

  // ── Selected object ─────────────────────────────────────────────────────
  selectedObject: null,   // CelestialObject | null
  flightTarget: null,     // CelestialObject to fly toward

  // ── Search state ────────────────────────────────────────────────────────
  searchQuery: '',
  searchResults: [],
  popularObjects: [],
  isSearching: false,

  // ── Saved objects (favourites) ───────────────────────────────────────────
  // Persisted to localStorage; full object payloads so they stay flyable.
  savedObjects: loadSavedObjects(),

  // ── UI state ─────────────────────────────────────────────────────────────
  isInfoPanelOpen: false,
  isLoading: false,
  loadingMessage: '',
  error: null,

  // ── Telescope state ──────────────────────────────────────────────────────
  telescopeRA: 0,
  telescopeDec: 0,
  isAutoRotating: true,

  // ── Language / i18n ──────────────────────────────────────────────────────
  // 'en' | 'bs' — persisted so the choice survives scene changes and reloads.
  language:
    (typeof localStorage !== 'undefined' && localStorage.getItem('lang')) || 'en',

  // ── Actions ──────────────────────────────────────────────────────────────
  setScene: (scene) => set({ scene }),

  enterObservatory: () => set({ scene: 'entering' }),
  arrivedAtObservatory: () => set({ scene: 'observatory' }),

  targetObject: (object) => set({
    scene: 'targeting',
    selectedObject: object,
    telescopeRA: object.ra ?? 0,
    telescopeDec: object.dec ?? 0,
  }),

  beginFlight: () => set({ scene: 'flying', isLoading: true, loadingMessage: 'Calculating trajectory...' }),

  arriveAtObject: () => set({
    scene: 'viewing',
    isLoading: false,
    isInfoPanelOpen: true,
    loadingMessage: '',
  }),

  returnToObservatory: () => set({
    scene: 'observatory',
    selectedObject: null,
    flightTarget: null,
    isInfoPanelOpen: false,
    error: null,
  }),

  setSelectedObject: (object) => set({ selectedObject: object }),
  setFlightTarget: (target) => set({ flightTarget: target }),

  setSearchQuery: (query) => set({ searchQuery: query }),
  setSearchResults: (results) => set({ searchResults: results }),
  setPopularObjects: (objects) => set({ popularObjects: objects }),
  setSearching: (isSearching) => set({ isSearching }),

  // ── Saved-object actions ─────────────────────────────────────────────────
  isSaved: (id) => get().savedObjects.some((o) => o.id === id),
  toggleSaved: (object) => {
    if (!object?.id) return
    const existing = get().savedObjects
    const next = existing.some((o) => o.id === object.id)
      ? existing.filter((o) => o.id !== object.id)
      : [...existing, object]
    persistSavedObjects(next)
    set({ savedObjects: next })
  },
  removeSaved: (id) => {
    const next = get().savedObjects.filter((o) => o.id !== id)
    persistSavedObjects(next)
    set({ savedObjects: next })
  },

  setLoading: (isLoading, message = '') => set({ isLoading, loadingMessage: message }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),

  setInfoPanelOpen: (open) => set({ isInfoPanelOpen: open }),
  setTelescopePointing: (ra, dec) => set({ telescopeRA: ra, telescopeDec: dec }),
  toggleAutoRotate: () => set((state) => ({ isAutoRotating: !state.isAutoRotating })),

  setLanguage: (language) => {
    try { localStorage.setItem('lang', language) } catch { /* ignore */ }
    set({ language })
  },
}))

export default useObservatoryStore
