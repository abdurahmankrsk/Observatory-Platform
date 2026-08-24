'use client'

/**
 * OcularView — Telescope eyepiece overlay effect.
 * Shown during 'targeting' phase: circular vignette + atmospheric distortion.
 */
import React, { useEffect, useRef } from 'react'
import anime from 'animejs'
import useObservatoryStore from '../../store/observatoryStore'
import { useTranslation } from '../../i18n'

export default function OcularView() {
  const containerRef = useRef()
  const { t } = useTranslation()
  const scene = useObservatoryStore((s) => s.scene)
  const isTargeting = scene === 'targeting'

  useEffect(() => {
    if (!containerRef.current) return
    let anim
    if (isTargeting) {
      anim = anime({
        targets: containerRef.current,
        opacity: [0, 1],
        duration: 500,
        easing: 'easeOutQuad',
      })
    } else {
      anim = anime({
        targets: containerRef.current,
        opacity: [1, 0],
        duration: 300,
        easing: 'easeInQuad',
      })
    }
    return () => {
      if (anim) anim.pause()
    }
  }, [isTargeting])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 15,
        opacity: 0,
      }}
    >
      {/* Radial vignette mask — simulates eyepiece */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `
          radial-gradient(
            circle at center,
            transparent 35%,
            rgba(1,10,20,0.6) 55%,
            rgba(1,10,20,0.95) 70%,
            rgba(1,10,20,1) 80%
          )
        `,
      }} />

      {/* Reticle crosshairs */}
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {/* Horizontal hair */}
        <div style={{
          position: 'absolute',
          width: '30%',
          height: 1,
          background: 'rgba(79,172,254,0.25)',
        }} />
        {/* Vertical hair */}
        <div style={{
          position: 'absolute',
          height: '30%',
          width: 1,
          background: 'rgba(79,172,254,0.25)',
        }} />
        {/* Center circle */}
        <div style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          border: '1px solid rgba(79,172,254,0.5)',
          background: 'transparent',
        }} />
        {/* Outer reticle ring */}
        <div style={{
          position: 'absolute',
          width: '72%',
          aspectRatio: '1',
          borderRadius: '50%',
          border: '1px solid rgba(79,172,254,0.12)',
        }} />
      </div>

      {/* Atmospheric shimmer — slow subtle distortion text */}
      <div style={{
        position: 'absolute',
        bottom: '28%',
        left: '50%',
        transform: 'translateX(-50%)',
        textAlign: 'center',
      }}>
        <p className="text-label" style={{ color: 'rgba(79,172,254,0.4)', fontSize: '0.6rem', letterSpacing: '0.3em' }}>
          {t('ocular.seeing')}
        </p>
      </div>
    </div>
  )
}
