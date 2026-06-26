/**
 * Zustand global state store — the single source of truth for the entire app.
 * State machine: start → entering → observatory → targeting → flying → viewing
 */
import { create } from 'zustand'

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

  // ── UI state ─────────────────────────────────────────────────────────────
  isInfoPanelOpen: false,
  isLoading: false,
  loadingMessage: '',
  error: null,

  // ── Telescope state ──────────────────────────────────────────────────────
  telescopeRA: 0,
  telescopeDec: 0,

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

  setLoading: (isLoading, message = '') => set({ isLoading, loadingMessage: message }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),

  setInfoPanelOpen: (open) => set({ isInfoPanelOpen: open }),
  setTelescopePointing: (ra, dec) => set({ telescopeRA: ra, telescopeDec: dec }),
}))

export default useObservatoryStore
