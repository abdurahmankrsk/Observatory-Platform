/**
 * CoordinateInput — RA/Dec manual coordinate entry panel.
 * Allows users to point the telescope at arbitrary sky coordinates.
 */
import React, { useEffect, useRef, useState } from 'react'
import anime from 'animejs'
import useObservatoryStore from '../../store/observatoryStore'

export default function CoordinateInput() {
  const panelRef = useRef()
  const [ra, setRa] = useState('')
  const [dec, setDec] = useState('')
  const [error, setError] = useState('')

  const setTelescopePointing = useObservatoryStore((s) => s.setTelescopePointing)
  const targetObject = useObservatoryStore((s) => s.targetObject)

  useEffect(() => {
    anime({
      targets: panelRef.current,
      translateX: [320, 0],
      opacity: [0, 1],
      duration: 700,
      easing: 'spring(1, 80, 10, 0)',
      delay: 200,
    })
  }, [])

  const handlePoint = () => {
    setError('')
    const raVal = parseFloat(ra)
    const decVal = parseFloat(dec)

    if (isNaN(raVal) || raVal < 0 || raVal > 360) {
      setError('RA must be 0–360°')
      return
    }
    if (isNaN(decVal) || decVal < -90 || decVal > 90) {
      setError('Dec must be -90 to +90°')
      return
    }

    // Create a synthetic object for the coordinate point
    const coordObj = {
      id: `coord_${raVal}_${decVal}`,
      name: `RA ${raVal.toFixed(2)}° Dec ${decVal.toFixed(2)}°`,
      type: 'star',
      ra: raVal,
      dec: decVal,
      distance_ly: 1000,
      description: 'A custom sky coordinate entered by the observer.',
    }

    setTelescopePointing(raVal, decVal)
    targetObject(coordObj)
  }

  return (
    <div
      ref={panelRef}
      className="panel"
      style={{
        position: 'fixed',
        right: 24,
        bottom: 80,
        width: 260,
        padding: 20,
        zIndex: 20,
        opacity: 0,
      }}
    >
      <p className="text-label" style={{ marginBottom: 16 }}>COORDINATE INPUT</p>

      <div style={{ marginBottom: 12 }}>
        <label className="text-label" style={{ display: 'block', marginBottom: 4, color: 'var(--color-dim)' }}>
          RA (0 – 360°)
        </label>
        <input
          id="ra-input"
          className="input-field"
          placeholder="e.g. 83.8221"
          value={ra}
          onChange={(e) => setRa(e.target.value)}
          type="number"
          min="0"
          max="360"
          step="0.0001"
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label className="text-label" style={{ display: 'block', marginBottom: 4, color: 'var(--color-dim)' }}>
          Dec (-90 – +90°)
        </label>
        <input
          id="dec-input"
          className="input-field"
          placeholder="e.g. -5.3911"
          value={dec}
          onChange={(e) => setDec(e.target.value)}
          type="number"
          min="-90"
          max="90"
          step="0.0001"
        />
      </div>

      {error && (
        <p style={{ color: 'var(--color-amber)', fontSize: '0.75rem', marginBottom: 10 }}>
          {error}
        </p>
      )}

      <button
        id="point-telescope-btn"
        className="btn-primary"
        style={{ width: '100%', justifyContent: 'center' }}
        onClick={handlePoint}
      >
        POINT TELESCOPE
      </button>

      {/* Corner decorations */}
      <div className="corner-tl" />
      <div className="corner-tr" />
      <div className="corner-bl" />
      <div className="corner-br" />
    </div>
  )
}
