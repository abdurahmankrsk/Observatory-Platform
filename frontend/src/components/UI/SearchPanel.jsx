/**
 * SearchPanel — Left-side search UI inside the observatory.
 * Search runs only when the user presses Enter or the search button. Editing the
 * query cancels any in-flight request and clears stale results.
 * Anime.js slide-in animation on mount.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react'
import anime from 'animejs'
import useObservatoryStore from '../../store/observatoryStore'
import { useSearchMutation, usePopularObjects } from '../../hooks/useNASAData'
import { useTranslation } from '../../i18n'

const TYPE_ICONS = {
  planet: '🪐',
  exoplanet: '🌍',
  moon: '🌙',
  asteroid: '☄️',
  comet: '☄️',
  star: '⭐',
  blackhole: '🕳️',
  nebula: '🌌',
  galaxy: '🌠',
}

function ObjectCard({ obj, onClick, tType }) {
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
      <span className={badgeClass}>{tType(obj.type)}</span>
    </button>
  )
}

export default function SearchPanel() {
  const panelRef = useRef()
  const abortRef = useRef(null)
  const [query, setQuery] = useState('')
  const [hasSearched, setHasSearched] = useState(false)
  const { t, tType } = useTranslation()

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

  // Abort any in-flight request on unmount.
  useEffect(() => () => { if (abortRef.current) abortRef.current.abort() }, [])

  // Run the search — only called on explicit submit (Enter / button click).
  const runSearch = useCallback(() => {
    const q = query.trim()
    if (!q) { setSearchResults([]); setHasSearched(false); return }
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setHasSearched(true)
    searchMutation.mutate(
      { query: q, signal: controller.signal },
      { onSuccess: (data) => setSearchResults(data.results ?? []) }
    )
  }, [query, searchMutation, setSearchResults])

  // Editing the query cancels any running search and clears stale results.
  const handleChange = useCallback((e) => {
    setQuery(e.target.value)
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null }
    searchMutation.reset()
    setSearchResults([])
    setHasSearched(false)
  }, [searchMutation, setSearchResults])

  const handleSelect = useCallback((obj) => {
    targetObject(obj)
  }, [targetObject])

  const showingResults = hasSearched && !!query.trim()
  const displayItems = showingResults ? searchResults : (popular ?? [])

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
        <p className="text-label" style={{ marginBottom: 6 }}>{t('search.title')}</p>
        <form
          onSubmit={(e) => { e.preventDefault(); runSearch() }}
          style={{ position: 'relative', display: 'flex' }}
        >
          <input
            id="search-input"
            className="input-field"
            placeholder={t('search.placeholder')}
            value={query}
            onChange={handleChange}
            autoComplete="off"
            style={{ paddingRight: 38 }}
          />
          <button
            type="submit"
            aria-label={t('search.action')}
            title={t('search.actionHint')}
            style={{
              position: 'absolute', right: 4, top: 4, bottom: 4, width: 30,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--color-blue)', padding: 0,
            }}
          >
            {searchMutation.isPending ? (
              <span className="spinner" style={{ width: 16, height: 16 }} />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.5" y2="16.5" />
              </svg>
            )}
          </button>
        </form>
      </div>

      {/* Divider */}
      <div className="divider" style={{ marginBottom: 12 }} />

      {/* Results / Popular objects */}
      <p className="text-label" style={{ marginBottom: 8 }}>
        {showingResults ? t('search.results', { count: displayItems.length }) : t('search.popular')}
      </p>

      {/* Error */}
      {searchMutation.isError && (
        <p style={{ fontSize: '0.75rem', color: 'var(--color-amber)', marginBottom: 8 }}>
          {t('search.failed')}
        </p>
      )}

      {/* Object list */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {!showingResults && query.trim() && !searchMutation.isPending && (
          <p style={{ color: 'var(--color-dim)', fontSize: '0.8125rem', padding: '8px 0' }}>
            {t('search.pressEnter')}
          </p>
        )}
        {showingResults && displayItems.length === 0 && !searchMutation.isPending && (
          <p style={{ color: 'var(--color-dim)', fontSize: '0.8125rem', padding: '8px 0' }}>
            {t('search.noResults')}
          </p>
        )}
        {displayItems.map((obj) => (
          <ObjectCard key={obj.id} obj={obj} onClick={handleSelect} tType={tType} />
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
