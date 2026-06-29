'use client'

/**
 * CoordinateInput — RA/Dec manual coordinate entry panel.
 * Allows users to point the telescope at arbitrary sky coordinates.
 */
import React, { useEffect, useRef, useState } from 'react'
import anime from 'animejs'
import useObservatoryStore from '../../store/observatoryStore'
import { useIdentifyMutation } from '../../hooks/useNASAData'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useTranslation } from '../../i18n'

export default function CoordinateInput() {
  const panelRef = useRef()
  const [ra, setRa] = useState('')
  const [dec, setDec] = useState('')
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [isMinimized, setIsMinimized] = useState(false)
  const { t } = useTranslation()
  const isMobile = useIsMobile()

  const setTelescopePointing = useObservatoryStore((s) => s.setTelescopePointing)
  const targetObject = useObservatoryStore((s) => s.targetObject)
  const identifyMutation = useIdentifyMutation()

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

  const handlePoint = async () => {
    setError('')
    setNote('')
    const raVal = parseFloat(ra)
    const decVal = parseFloat(dec)

    if (isNaN(raVal) || raVal < 0 || raVal > 360) {
      setError(t('coord.raError'))
      return
    }
    if (isNaN(decVal) || decVal < -90 || decVal > 90) {
      setError(t('coord.decError'))
      return
    }

    // Synthetic fallback used when nothing is catalogued at this point.
    const coordObj = {
      id: `coord_${raVal}_${decVal}`,
      name: `RA ${raVal.toFixed(2)}° Dec ${decVal.toFixed(2)}°`,
      type: 'star',
      ra: raVal,
      dec: decVal,
      distance_ly: 1000,
      description: t('coord.customDesc'),
    }

    // Immediate feedback: swing the telescope while the lookup runs.
    setTelescopePointing(raVal, decVal)

    try {
      const data = await identifyMutation.mutateAsync({ ra: raVal, dec: decVal })
      if (data?.found && data.object) {
        setNote(
          data.separation_deg != null
            ? t('coord.foundAway', { name: data.object.name, deg: data.separation_deg.toFixed(3) })
            : t('coord.found', { name: data.object.name })
        )
        targetObject(data.object)
      } else {
        setNote(t('coord.noObject', { deg: data?.radius_deg ?? 0.1 }))
        targetObject(coordObj)
      }
    } catch (e) {
      setNote(t('coord.lookupFailed'))
      targetObject(coordObj)
    }
  }

  return (
    <div
      ref={panelRef}
      className="panel"
      style={{
        position: 'fixed',
        right: isMobile ? 8 : 24,
        bottom: isMobile ? 8 : 80,
        width: isMobile ? 220 : 260,
        maxHeight: isMobile ? (isMinimized ? 'auto' : '85vh') : 'auto',
        display: 'flex',
        flexDirection: 'column',
        padding: isMobile ? 12 : 20,
        zIndex: 20,
        opacity: 0,
      }}
    >
      <div style={{ marginBottom: isMinimized ? 0 : 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p className="text-label" style={{ marginBottom: 0 }}>{t('coord.title')}</p>
        <button 
          onClick={() => setIsMinimized(!isMinimized)} 
          style={{ background: 'none', border: 'none', color: 'var(--color-dim)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 0 }}
        >
          {isMinimized ? '+' : '−'}
        </button>
      </div>

      {!isMinimized && (
        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
          <div style={{ marginBottom: 12 }}>
        <label className="text-label" style={{ display: 'block', marginBottom: 4, color: 'var(--color-dim)' }}>
          {t('coord.raLabel')}
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
          {t('coord.decLabel')}
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

      {note && (
        <p style={{ color: 'var(--color-dim)', fontSize: '0.75rem', marginBottom: 10 }}>
          {note}
        </p>
      )}

      <button
        id="point-telescope-btn"
        className="btn-primary"
        style={{ width: '100%', justifyContent: 'center', gap: 8 }}
        onClick={handlePoint}
        disabled={identifyMutation.isPending}
      >
        {identifyMutation.isPending && <span className="spinner" />}
        {identifyMutation.isPending ? t('coord.identifying') : t('coord.point')}
      </button>
      
        </div>
      )}

      {/* Corner decorations */}
      <div className="corner-tl" />
      <div className="corner-tr" />
      <div className="corner-bl" />
      <div className="corner-br" />
    </div>
  )
}
