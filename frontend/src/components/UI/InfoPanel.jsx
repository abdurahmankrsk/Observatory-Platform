/**
 * InfoPanel — Right-side sliding information panel.
 * Shows detailed data about the selected celestial object.
 * Slides in from the right on entering 'viewing' state.
 */
import React, { useEffect, useRef } from 'react'
import anime from 'animejs'
import useObservatoryStore from '../../store/observatoryStore'
import { formatDistance } from '../../utils/astronomyMath'
import { isInHabitableZone } from '../../utils/colorFromTemperature'
import { getSpectralClass } from '../../utils/colorFromTemperature'

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

function ExoplanetInfo({ data }) {
  if (!data) return null
  const habitable = isInHabitableZone(data.equilibrium_temp_k)
  return (
    <div>
      <DataRow label="RADIUS" value={data.radius_earth ? `${data.radius_earth.toFixed(2)} R⊕` : null} />
      <DataRow label="MASS" value={data.mass_earth ? `${data.mass_earth.toFixed(2)} M⊕` : null} />
      <DataRow label="ORBITAL PERIOD" value={data.orbital_period_days ? `${data.orbital_period_days.toFixed(1)} days` : null} />
      <DataRow label="SEMI-MAJOR AXIS" value={data.semi_major_axis_au ? `${data.semi_major_axis_au.toFixed(3)} AU` : null} />
      <DataRow label="EQUILIBRIUM TEMP" value={data.equilibrium_temp_k ? `${data.equilibrium_temp_k.toFixed(0)} K` : null} />
      <DataRow label="STAR TEMP" value={data.star_temperature_k ? `${data.star_temperature_k.toFixed(0)} K` : null} />
      <DataRow
        label="HABITABLE ZONE"
        value={habitable ? '✓ POSSIBLY' : '✗ UNLIKELY'}
        highlight={habitable}
      />
    </div>
  )
}

function StarInfo({ data }) {
  if (!data) return null
  return (
    <div>
      <DataRow label="SPECTRAL CLASS" value={data.spectral_type ?? (data.temperature_k ? getSpectralClass(data.temperature_k) : null)} />
      <DataRow label="TEMPERATURE" value={data.temperature_k ? `${data.temperature_k.toFixed(0)} K` : null} />
      <DataRow label="RADIUS" value={data.radius_solar ? `${data.radius_solar.toFixed(2)} R☉` : null} />
      <DataRow label="LUMINOSITY" value={data.luminosity_solar ? `${data.luminosity_solar.toFixed(2)} L☉` : null} />
    </div>
  )
}

function AsteroidInfo({ data, approach }) {
  if (!data && !approach) return null
  return (
    <div>
      {data && (
        <>
          <DataRow label="DIAMETER" value={
            data.diameter_min_km && data.diameter_max_km
              ? `${data.diameter_min_km.toFixed(3)}–${data.diameter_max_km.toFixed(3)} km`
              : null
          } />
          <DataRow
            label="HAZARDOUS"
            value={data.is_potentially_hazardous ? '⚠ YES' : 'NO'}
            highlight={false}
          />
        </>
      )}
      {approach && (
        <>
          <DataRow label="MISS DISTANCE" value={`${(approach.miss_distance_km / 1e6).toFixed(2)}M km`} />
          <DataRow label="VELOCITY" value={`${approach.relative_velocity_km_s.toFixed(2)} km/s`} />
          <DataRow label="APPROACH DATE" value={approach.date} />
        </>
      )}
    </div>
  )
}

export default function InfoPanel() {
  const panelRef = useRef()
  const selectedObject = useObservatoryStore((s) => s.selectedObject)
  const beginFlight = useObservatoryStore((s) => s.beginFlight)
  const returnToObservatory = useObservatoryStore((s) => s.returnToObservatory)
  const scene = useObservatoryStore((s) => s.scene)

  const isTargeting = scene === 'targeting'
  const isViewing = scene === 'viewing'

  // Slide-in animation when entering targeting or viewing state
  useEffect(() => {
    if ((isTargeting || isViewing) && panelRef.current) {
      anime({
        targets: panelRef.current,
        translateX: [400, 0],
        opacity: [0, 1],
        duration: 600,
        easing: 'spring(1, 80, 10, 0)',
      })
    }
  }, [isTargeting, isViewing])

  if (!selectedObject || (!isTargeting && !isViewing)) return null

  const badgeClass = `badge badge--${selectedObject.type}`

  return (
    <div
      ref={panelRef}
      className="panel"
      style={{
        position: 'fixed',
        right: 24,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 320,
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        padding: 24,
        zIndex: 20,
        opacity: 0,
        overflowY: 'auto',
      }}
    >
      {/* Object type badge */}
      <div style={{ marginBottom: 12 }}>
        <span className={badgeClass}>{selectedObject.type.toUpperCase()}</span>
      </div>

      {/* Object name */}
      <h2 className="text-display" style={{
        fontSize: '1.25rem',
        fontWeight: 600,
        color: 'var(--color-star)',
        marginBottom: 8,
        lineHeight: 1.2,
      }}>
        {selectedObject.name}
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
      {selectedObject.description && (
        <p style={{
          color: 'var(--color-grey)',
          fontSize: '0.8125rem',
          lineHeight: 1.6,
          marginBottom: 16,
        }}>
          {selectedObject.description}
        </p>
      )}

      <div className="divider" style={{ marginBottom: 16 }} />

      {/* Type-specific data */}
      {(selectedObject.type === 'exoplanet' || selectedObject.type === 'planet') && (
        <ExoplanetInfo data={selectedObject.exoplanet} />
      )}
      {selectedObject.type === 'star' && <StarInfo data={selectedObject.star} />}
      {selectedObject.type === 'asteroid' && (
        <AsteroidInfo data={selectedObject.asteroid} approach={selectedObject.close_approach} />
      )}

      {/* Coordinates */}
      {(selectedObject.ra != null || selectedObject.dec != null) && (
        <>
          <div className="divider" style={{ margin: '16px 0' }} />
          <DataRow label="RA" value={selectedObject.ra != null ? `${selectedObject.ra.toFixed(4)}°` : null} />
          <DataRow label="DEC" value={selectedObject.dec != null ? `${selectedObject.dec.toFixed(4)}°` : null} />
        </>
      )}

      {/* Fun fact */}
      {selectedObject.fun_fact && (
        <div style={{
          marginTop: 16,
          padding: '12px',
          background: 'rgba(79,172,254,0.05)',
          border: '1px solid rgba(79,172,254,0.15)',
          borderRadius: 1,
        }}>
          <p className="text-label" style={{ marginBottom: 6 }}>DID YOU KNOW</p>
          <p style={{ color: 'var(--color-grey)', fontSize: '0.8125rem', lineHeight: 1.5 }}>
            {selectedObject.fun_fact}
          </p>
        </div>
      )}

      {/* Actions */}
      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {isTargeting && (
          <button
            id="fly-to-btn"
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={beginFlight}
          >
            FLY TO {selectedObject.name.split(' ')[0].toUpperCase()}
          </button>
        )}
        <button
          id="back-to-observatory-btn"
          className="btn-ghost"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={returnToObservatory}
        >
          BACK TO OBSERVATORY
        </button>
      </div>

      {/* Corner decorations */}
      <div className="corner-tl" />
      <div className="corner-tr" />
      <div className="corner-bl" />
      <div className="corner-br" />
    </div>
  )
}
