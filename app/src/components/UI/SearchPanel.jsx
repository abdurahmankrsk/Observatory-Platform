'use client'

/**
 * SearchPanel — Left-side search UI inside the observatory.
 * Search runs only when the user presses Enter or the search button. Editing the
 * query cancels any in-flight request and clears stale results.
 * Anime.js slide-in animation on mount.
 */
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import anime from 'animejs'
import useObservatoryStore from '../../store/observatoryStore'
import { useSearchMutation, usePopularObjects } from '../../hooks/useNASAData'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useTranslation } from '../../i18n'
import { buildAppearance } from '../../procedural/ProceduralAppearanceBuilder'
import { CelestialType } from '../../procedural/CelestialType'

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

function ObjectCard({ obj, onClick, tType, saved, onToggleSave, saveLabel, unsaveLabel }) {
  const isMobile = useIsMobile()
  const badgeClass = `badge badge--${obj.type}`
  // Only override the label for objects where the coarse type is misleading.
  // Currently: quasars come back as type 'galaxy' from SIMBAD — promote those.
  // Everything else (star, planet, nebula, moon…) shows its coarse type as-is.
  const fineType = useMemo(() => {
    if (obj.type !== 'galaxy') return obj.type
    const appearance = buildAppearance(obj)
    const ct = appearance?.celestialType
    return ct === CelestialType.Quasar ? ct : obj.type
  }, [obj])
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 2, marginBottom: 4 }}>
      <button
        className="btn-ghost"
        style={{
          flex: 1,
          minWidth: 0,
          justifyContent: 'flex-start',
          padding: '10px 12px',
          gap: 10,
          textAlign: 'left',
          borderRadius: 1,
        }}
        onClick={() => onClick(obj)}
      >
        {!isMobile && <span style={{ fontSize: 16 }}>{TYPE_ICONS[obj.type] ?? '✦'}</span>}
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8125rem', color: 'var(--color-star)' }}>
          {obj.name}
        </span>
        {!isMobile && <span className={badgeClass}>{tType(fineType)}</span>}
      </button>
      <button
        className="btn-ghost"
        aria-label={saved ? unsaveLabel : saveLabel}
        title={saved ? unsaveLabel : saveLabel}
        aria-pressed={saved}
        onClick={(e) => { e.stopPropagation(); onToggleSave(obj) }}
        style={{
          flex: '0 0 auto',
          width: 32,
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 15,
          lineHeight: 1,
          borderRadius: 1,
          color: saved ? 'var(--color-amber)' : 'var(--color-dim)',
        }}
      >
        {saved ? '★' : '☆'}
      </button>
    </div>
  )
}

export default function SearchPanel() {
  const panelRef = useRef()
  const abortRef = useRef(null)
  const [query, setQuery] = useState('')
  const [hasSearched, setHasSearched] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const { t, tType } = useTranslation()
  const isMobile = useIsMobile()

  const targetObject = useObservatoryStore((s) => s.targetObject)
  const searchResults = useObservatoryStore((s) => s.searchResults)
  const setSearchResults = useObservatoryStore((s) => s.setSearchResults)
  const savedObjects = useObservatoryStore((s) => s.savedObjects)
  const toggleSaved = useObservatoryStore((s) => s.toggleSaved)
  const savedIds = new Set(savedObjects.map((o) => o.id))

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

  const renderCard = (obj) => (
    <ObjectCard
      key={obj.id}
      obj={obj}
      onClick={handleSelect}
      tType={tType}
      saved={savedIds.has(obj.id)}
      onToggleSave={toggleSaved}
      saveLabel={t('search.save')}
      unsaveLabel={t('search.unsave')}
    />
  )

  return (
    <div
      ref={panelRef}
      className="panel"
      style={{
        position: 'fixed',
        left: isMobile ? 8 : 24,
        top: isMobile ? 80 : '50%',
        transform: isMobile ? 'none' : 'translateY(-50%)',
        width: isMobile ? 180 : 300,
        maxHeight: isMobile ? (isMinimized ? 'auto' : '35vh') : (isMinimized ? 'auto' : '75vh'),
        display: 'flex',
        flexDirection: 'column',
        padding: isMobile ? 12 : 20,
        zIndex: 20,
        opacity: 0,
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: isMinimized ? 0 : 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p className="text-label" style={{ marginBottom: 0 }}>{t('search.title')}</p>
        <button 
          onClick={() => setIsMinimized(!isMinimized)} 
          style={{ background: 'none', border: 'none', color: 'var(--color-dim)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 0 }}
        >
          {isMinimized ? '+' : '−'}
        </button>
      </div>

      {!isMinimized && (
        <>
          <div style={{ marginBottom: 16 }}>
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

          {/* Error */}
          {searchMutation.isError && (
            <p style={{ fontSize: '0.75rem', color: 'var(--color-amber)', marginBottom: 8 }}>
              {t('search.failed')}
            </p>
          )}

          {/* Object list — search results, or saved + popular when not searching */}
          <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
            {showingResults ? (
              <>
                <p className="text-label" style={{ marginBottom: 8 }}>
                  {t('search.results', { count: searchResults.length })}
                </p>
                {searchResults.length === 0 && !searchMutation.isPending && (
                  <p style={{ color: 'var(--color-dim)', fontSize: '0.8125rem', padding: '8px 0' }}>
                    {t('search.noResults')}
                  </p>
                )}
                {searchResults.map(renderCard)}
              </>
            ) : query.trim() && !searchMutation.isPending ? (
              <p style={{ color: 'var(--color-dim)', fontSize: '0.8125rem', padding: '8px 0' }}>
                {t('search.pressEnter')}
              </p>
            ) : (
              <>
                {savedObjects.length > 0 && (
                  <>
                    <p className="text-label" style={{ marginBottom: 8 }}>{t('search.saved')}</p>
                    {savedObjects.map(renderCard)}
                    <div className="divider" style={{ margin: '12px 0' }} />
                  </>
                )}
                <p className="text-label" style={{ marginBottom: 8 }}>{t('search.popular')}</p>
                {(popular ?? []).map(renderCard)}
              </>
            )}
          </div>
        </>
      )}

      {/* Corner decorations */}
      <div className="corner-tl" />
      <div className="corner-tr" />
      <div className="corner-bl" />
      <div className="corner-br" />
    </div>
  )
}
