import { describe, it, expect, beforeEach } from 'vitest'
import useObservatoryStore from './observatoryStore'

describe('observatoryStore', () => {
  beforeEach(() => {
    // Reset store state before each test if needed
    // Zustand stores maintain state between tests unless we clear it or reset it.
    // For these simple tests, we can just grab the store and verify the transitions.
    useObservatoryStore.setState({
      scene: 'start',
      selectedObject: null,
      flightTarget: null,
      searchQuery: '',
      searchResults: [],
      popularObjects: [],
      isSearching: false,
      isInfoPanelOpen: false,
      isLoading: false,
      loadingMessage: '',
      error: null,
      telescopeRA: 0,
      telescopeDec: 0,
      isAutoRotating: true,
    })
  })

  it('starts with the correct initial state', () => {
    const state = useObservatoryStore.getState()
    expect(state.scene).toBe('start')
    expect(state.selectedObject).toBeNull()
  })

  it('can enter the observatory', () => {
    const { enterObservatory } = useObservatoryStore.getState()
    enterObservatory()
    
    const state = useObservatoryStore.getState()
    expect(state.scene).toBe('entering')
  })

  it('transitions to observatory when arrived', () => {
    const { arrivedAtObservatory } = useObservatoryStore.getState()
    arrivedAtObservatory()
    
    const state = useObservatoryStore.getState()
    expect(state.scene).toBe('observatory')
  })

  it('targets an object correctly', () => {
    const testObject = { id: 1, name: 'Mars', ra: 10, dec: 20 }
    const { targetObject } = useObservatoryStore.getState()
    targetObject(testObject)
    
    const state = useObservatoryStore.getState()
    expect(state.scene).toBe('targeting')
    expect(state.selectedObject).toEqual(testObject)
    expect(state.telescopeRA).toBe(10)
    expect(state.telescopeDec).toBe(20)
  })
})
