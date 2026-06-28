/**
 * SearchPanel — Left-side search UI inside the observatory.
 * Debounced search input + popular objects quick-access list.
 * Anime.js slide-in animation on mount.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react'
import anime from 'animejs'
import useObservatoryStore from '../../store/observatoryStore'
import { useSearchMutation, usePopularObjects } from '../../hooks/useNASAData'

const TYPE_ICONS = {
  planet: '🪐',
  exoplanet: '🌍',
  asteroid: '☄️',
  star: '⭐',
  nebula: '🌌',
  galaxy: '🌠',
}

function ObjectCard({ obj, onClick }) {
  const badgeClass = `badge badge--${obj.type}`
  return (
    <button
      className="btn-ghost"
      style={{
        width: '100%',
        justifyContent: 'flex-start',
        padding: '10px 12px',
        gap: 10,
        textAlign: 'left',
        marginBottom: 4,
        borderRadius: 1,
      }}
      onClick={() => onClick(obj)}
    >
      <span style={{ fontSize: 16 }}>{TYPE_ICONS[obj.type] ?? '✦'}</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8125rem', color: 'var(--color-star)' }}>
        {obj.name}
      </span>
      <span className={badgeClass}>{obj.type}</span>
    </button>
  )
}

export default function SearchPanel() {
  const panelRef = useRef()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  const targetObject = useObservatoryStore((s) => s.targetObject)
  const searchResults = useObservatoryStore((s) => s.searchResults)
  const setSearchResults = useObservatoryStore((s) => s.setSearchResults)

  const { data: popular } = usePopularObjects()
  const searchMutation = useSearchMutation()

  // Slide-in animation on mount
  useEffect(() => {
    anime({
      targets: panelRef.current,
      translateX: [-320, 0],
      opacity: [0, 1],
      duration: 700,
      easing: 'spring(1, 80, 10, 0)',
    })
  }, [])

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 400)
    return () => clearTimeout(timer)
  }, [query])

  // Execute search when debounced query changes
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setSearchResults([])
      return
    }
    searchMutation.mutate(debouncedQuery, {
      onSuccess: (data) => setSearchResults(data.results ?? []),
    })
  }, [debouncedQuery])

  const handleSelect = useCallback((obj) => {
    targetObject(obj)
  }, [targetObject])

  const displayItems = query.trim() ? searchResults : (popular ?? [])

  return (
    <div
      ref={panelRef}
      className="panel"
      style={{
        position: 'fixed',
        left: 24,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 300,
        maxHeight: '75vh',
        display: 'flex',
        flexDirection: 'column',
        padding: 20,
        zIndex: 20,
        opacity: 0,
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <p className="text-label" style={{ marginBottom: 6 }}>SEARCH OBJECT</p>
        <div style={{ position: 'relative' }}>
          <input
            id="search-input"
            className="input-field"
            placeholder="Andromeda, Kepler-452b, Vega..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
          {searchMutation.isPending && (
            <div className="spinner" style={{ position: 'absolute', right: 10, top: 'calc(50% - 12px)' }} />
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="divider" style={{ marginBottom: 12 }} />

      {/* Results / Popular objects */}
      <p className="text-label" style={{ marginBottom: 8 }}>
        {query.trim() ? `RESULTS (${displayItems.length})` : 'POPULAR OBJECTS'}
      </p>

      {/* Error */}
      {searchMutation.isError && (
        <p style={{ fontSize: '0.75rem', color: 'var(--color-amber)', marginBottom: 8 }}>
          Search failed. Check your connection.
        </p>
      )}

      {/* Object list */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {displayItems.length === 0 && !searchMutation.isPending && query.trim() && (
          <p style={{ color: 'var(--color-dim)', fontSize: '0.8125rem', padding: '8px 0' }}>
            No results found.
          </p>
        )}
        {displayItems.map((obj) => (
          <ObjectCard key={obj.id} obj={obj} onClick={handleSelect} />
        ))}
      </div>

      {/* Corner decorations */}
      <div className="corner-tl" />
      <div className="corner-tr" />
      <div className="corner-bl" />
      <div className="corner-br" />
    </div>
  )
}
