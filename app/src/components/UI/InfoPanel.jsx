'use client'

/**
 * InfoPanel — Right-side sliding information panel.
 * Shows detailed data about the selected celestial object.
 * Slides in from the right on entering 'viewing' state.
 */
import React, { useEffect, useRef, useState } from 'react'
import anime from 'animejs'
import useObservatoryStore from '../../store/observatoryStore'
import { useProceduralGen } from '../../hooks/useProceduralGen'
import { useTranslatedObject } from '../../hooks/useNASAData'
import { useIsMobile } from '../../hooks/useIsMobile'
import { formatDistance } from '../../utils/astronomyMath'
import { isInHabitableZone } from '../../utils/colorFromTemperature'
import { getSpectralClass } from '../../utils/colorFromTemperature'
import { useTranslation } from '../../i18n'

function DataRow({ label, value, highlight = false }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      padding: '6px 0',
      borderBottom: '1px solid rgba(79,172,254,0.06)',
    }}>
      <span className="text-label" style={{ color: 'var(--color-dim)' }}>{label}</span>
      <span className="text-mono" style={{
        fontSize: '0.8125rem',
        color: highlight ? 'var(--color-green-hab)' : 'var(--color-star)',
      }}>
        {value ?? '—'}
      </span>
    </div>
  )
}

function ExoplanetInfo({ data, t }) {
  if (!data) return null
  const habitable = isInHabitableZone(data.equilibrium_temp_k)
  return (
    <div>
      <DataRow label={t('info.radius')} value={data.radius_earth ? `${data.radius_earth.toFixed(2)} R⊕` : null} />
      <DataRow label={t('info.mass')} value={data.mass_earth ? `${data.mass_earth.toFixed(2)} M⊕` : null} />
      <DataRow label={t('info.orbitalPeriod')} value={data.orbital_period_days ? `${data.orbital_period_days.toFixed(1)} ${t('info.days')}` : null} />
      <DataRow label={t('info.semiMajorAxis')} value={data.semi_major_axis_au ? `${data.semi_major_axis_au.toFixed(3)} AU` : null} />
      <DataRow label={t('info.equilibriumTemp')} value={data.equilibrium_temp_k ? `${data.equilibrium_temp_k.toFixed(0)} K` : null} />
      <DataRow label={t('info.starTemp')} value={data.star_temperature_k ? `${data.star_temperature_k.toFixed(0)} K` : null} />
      <DataRow
        label={t('info.habitableZone')}
        value={habitable ? t('info.possibly') : t('info.unlikely')}
        highlight={habitable}
      />
    </div>
  )
}

function StarInfo({ data, t }) {
  if (!data) return null
  return (
    <div>
      <DataRow label={t('info.spectralClass')} value={data.spectral_type ?? (data.temperature_k ? getSpectralClass(data.temperature_k) : null)} />
      <DataRow label={t('info.temperature')} value={data.temperature_k ? `${data.temperature_k.toFixed(0)} K` : null} />
      <DataRow label={t('info.radius')} value={data.radius_solar ? `${data.radius_solar.toFixed(2)} R☉` : null} />
      <DataRow label={t('info.luminosity')} value={data.luminosity_solar ? `${data.luminosity_solar.toFixed(2)} L☉` : null} />
    </div>
  )
}

function AsteroidInfo({ data, approach, t }) {
  if (!data && !approach) return null
  return (
    <div>
      {data && (
        <>
          <DataRow label={t('info.diameter')} value={
            data.diameter_min_km && data.diameter_max_km
              ? `${data.diameter_min_km.toFixed(3)}–${data.diameter_max_km.toFixed(3)} km`
              : null
          } />
          <DataRow
            label={t('info.hazardous')}
            value={data.is_potentially_hazardous ? t('info.yes') : t('info.no')}
            highlight={false}
          />
        </>
      )}
      {approach && (
        <>
          <DataRow label={t('info.missDistance')} value={`${(approach.miss_distance_km / 1e6).toFixed(2)}M km`} />
          <DataRow label={t('info.velocity')} value={`${approach.relative_velocity_km_s.toFixed(2)} km/s`} />
          <DataRow label={t('info.approachDate')} value={approach.date} />
        </>
      )}
    </div>
  )
}

export default function InfoPanel() {
  const panelRef = useRef()
  const [isMinimized, setIsMinimized] = useState(false)
  const { t, tType, lang } = useTranslation()
  const isMobile = useIsMobile()
  const selectedObject = useObservatoryStore((s) => s.selectedObject)
  const beginFlight = useObservatoryStore((s) => s.beginFlight)
  const returnToObservatory = useObservatoryStore((s) => s.returnToObservatory)
  const scene = useObservatoryStore((s) => s.scene)
  const savedObjects = useObservatoryStore((s) => s.savedObjects)
  const toggleSaved = useObservatoryStore((s) => s.toggleSaved)
  const isSaved = !!selectedObject && savedObjects.some((o) => o.id === selectedObject.id)
  // Precise classified type (e.g. "Black Hole", "Pulsar") for the badge label.
  const appearance = useProceduralGen(selectedObject)
  // Free-text fields translated to the active language (no-op for English).
  const { description, fun_fact } = useTranslatedObject(selectedObject, lang)

  const isTargeting = scene === 'targeting'
  const isViewing = scene === 'viewing'

  // Slide-in animation when entering targeting or viewing state
  useEffect(() => {
    if ((isTargeting || isViewing) && panelRef.current) {
      anime({
        targets: panelRef.current,
        translateX: [400, 0],
        translateY: isMobile ? [0, 0] : ['-50%', '-50%'],
        opacity: [0, 1],
        duration: 600,
        easing: 'spring(1, 80, 10, 0)',
      })
    }
  }, [isTargeting, isViewing, isMobile])

  if (!selectedObject || (!isTargeting && !isViewing)) return null

  // Guard against an object with no/unknown type (e.g. an unclassifiable source)
  // so the panel degrades gracefully instead of crashing the app.
  const objType = selectedObject.type || 'unknown'
  const badgeClass = `badge badge--${objType}`
  // Show the fine classified type (Black Hole, Pulsar, Spiral Galaxy…) translated
  // to the active language, but keep the badge colour keyed to the coarse type
  // (the CSS classes are per coarse type). `.badge` CSS uppercases the text.
  const badgeText = tType(appearance?.celestialType || objType)

  return (
    <>
    <div
      ref={panelRef}
      className="panel"
      style={{
        position: 'fixed',
        right: isMobile ? 8 : 24,
        top: isMobile ? (isMinimized ? (isViewing ? 64 : 'auto') : 'auto') : '50%',
        bottom: isMobile ? (isMinimized ? (isViewing ? 'auto' : 64) : (isViewing ? 100 : 8)) : undefined,
        transform: isMobile ? 'none' : 'translateY(-50%)',
        width: isMobile ? (isMinimized ? 200 : 'calc(100vw - 170px)') : 320,
        maxHeight: isMobile ? (isMinimized ? 'auto' : '40vh') : (isMinimized ? 'auto' : '80vh'),
        display: 'flex',
        flexDirection: 'column',
        padding: isMobile ? 14 : 24,
        zIndex: 20,
        opacity: 0,
      }}
    >
      <div style={{ marginBottom: isMinimized ? 0 : 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className={badgeClass}>{badgeText}</span>
        <button 
          onClick={() => setIsMinimized(!isMinimized)} 
          style={{ background: 'none', border: 'none', color: 'var(--color-dim)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 0 }}
        >
          {isMinimized ? '+' : '−'}
        </button>
      </div>

      {!isMinimized && (
        <div style={{ overflowY: 'auto', flex: '0 1 auto', minHeight: 0 }}>
          {/* Object name */}
      <h2 className="text-display" style={{
        fontSize: '1.25rem',
        fontWeight: 600,
        color: 'var(--color-star)',
        marginBottom: 8,
        lineHeight: 1.2,
      }}>
        {selectedObject.name || 'Unknown Object'}
      </h2>

      {/* Distance */}
      <p className="text-mono" style={{
        color: 'var(--color-blue)',
        fontSize: '0.8125rem',
        marginBottom: 16,
      }}>
        {formatDistance(selectedObject)}
      </p>

      {/* Description */}
      {description && (
        <p style={{
          color: 'var(--color-grey)',
          fontSize: '0.8125rem',
          lineHeight: 1.6,
          marginBottom: 16,
        }}>
          {description}
        </p>
      )}

      <div className="divider" style={{ marginBottom: 16 }} />

      {/* Type-specific data */}
      {(selectedObject.type === 'exoplanet' || selectedObject.type === 'planet') && (
        <ExoplanetInfo data={selectedObject.exoplanet} t={t} />
      )}
      {selectedObject.type === 'star' && <StarInfo data={selectedObject.star} t={t} />}
      {selectedObject.type === 'asteroid' && (
        <AsteroidInfo data={selectedObject.asteroid} approach={selectedObject.close_approach} t={t} />
      )}

      {/* Coordinates */}
      {(selectedObject.ra != null || selectedObject.dec != null) && (
        <>
          <DataRow label={t('info.ra')} value={selectedObject.ra != null ? `${selectedObject.ra.toFixed(4)}°` : null} />
          <DataRow label={t('info.dec')} value={selectedObject.dec != null ? `${selectedObject.dec.toFixed(4)}°` : null} />
        </>
      )}

      {/* Fun fact */}
      {fun_fact && (
        <div style={{
          marginTop: 16,
          padding: '12px',
          background: 'rgba(79,172,254,0.05)',
          border: '1px solid rgba(79,172,254,0.15)',
          borderRadius: 1,
        }}>
          <p className="text-label" style={{ marginBottom: 6 }}>{t('info.didYouKnow')}</p>
          <p style={{ color: 'var(--color-grey)', fontSize: '0.8125rem', lineHeight: 1.5 }}>
            {fun_fact}
          </p>
        </div>
      )}

      {/* Actions (Mixed Desktop/Mobile) */}
      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(!isMobile && isTargeting) && (
          <button
            id="fly-to-btn"
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={beginFlight}
          >
            {t('info.flyTo', { name: (selectedObject.name || 'Target').replace(/^the\s+/i, '').split(/[\s(]/)[0].toUpperCase() })}
          </button>
        )}
        <button
          id="save-object-btn"
          className="btn-ghost"
          aria-pressed={isSaved}
          style={{
            width: '100%',
            justifyContent: 'center',
            color: isSaved ? 'var(--color-amber)' : undefined,
          }}
          onClick={() => toggleSaved(selectedObject)}
        >
          {isSaved ? t('info.saved') : t('info.save')}
        </button>
        {(!isMobile || isTargeting) && (
          <button
            id="back-to-observatory-btn"
            className="btn-ghost"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={returnToObservatory}
          >
            {t('info.back')}
          </button>
        )}
      </div>
        </div>
      )}

      {/* Corner decorations */}
      <div className="corner-tl" />
      <div className="corner-tr" />
      <div className="corner-bl" />
      <div className="corner-br" />
    </div>

    {/* Actions (Mobile only) - Rendered outside the panel so it stays truly fixed to the viewport */}
    {isMobile && (
      <div 
        style={{
          position: 'fixed',
          bottom: 64,
          left: 16,
          zIndex: 40,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          width: 140,
        }}
      >
        {isTargeting && (
          <button
            id="fly-to-btn-mobile"
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '12px 16px' }}
            onClick={beginFlight}
          >
            {t('info.flyTo', { name: (selectedObject.name || 'Target').replace(/^the\s+/i, '').split(/[\s(]/)[0].toUpperCase() })}
          </button>
        )}
        {isViewing && (
          <button
            id="back-to-observatory-btn-mobile"
            className="panel btn-ghost"
            style={{ width: '100%', justifyContent: 'center', background: 'var(--color-panel)' }}
            onClick={returnToObservatory}
          >
            {t('info.back')}
          </button>
        )}
      </div>
    )}
    </>
  )
}
