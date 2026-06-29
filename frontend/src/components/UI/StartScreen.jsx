/**
 * StartScreen — The first thing the user sees.
 * Particle star background (Three.js Canvas) + logo + ENTER button.
 * Anime.js entrance animation on mount.
 */
import React, { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import anime from 'animejs'
import useObservatoryStore from '../../store/observatoryStore'
import { useTranslation } from '../../i18n'

function StarField() {
  return (
    <>
      <Stars radius={300} depth={100} count={12000} factor={5} saturation={0.05} fade />
      <ambientLight intensity={0} />
    </>
  )
}

export default function StartScreen() {
  const containerRef = useRef()
  const logoRef = useRef()
  const subtitleRef = useRef()
  const btnRef = useRef()
  const lineRef = useRef()
  
  const [langOpen, setLangOpen] = useState(false)

  const { t, lang } = useTranslation()
  const setLanguage = useObservatoryStore((s) => s.setLanguage)
  const enterObservatory = useObservatoryStore((s) => s.enterObservatory)

  useEffect(() => {
    // Entrance sequence with anime.js timeline
    const tl = anime.timeline({ easing: 'easeOutExpo' })

    tl.add({
      targets: lineRef.current,
      scaleX: [0, 1],
      opacity: [0, 1],
      duration: 1000,
      delay: 400,
    })
    .add({
      targets: logoRef.current,
      translateY: [40, 0],
      opacity: [0, 1],
      duration: 1200,
    }, '-=600')
    .add({
      targets: subtitleRef.current,
      translateY: [20, 0],
      opacity: [0, 1],
      duration: 800,
    }, '-=600')
    .add({
      targets: btnRef.current,
      translateY: [20, 0],
      opacity: [0, 1],
      duration: 600,
    }, '-=400')
  }, [])

  const handleEnter = () => {
    // Exit animation
    anime({
      targets: containerRef.current,
      opacity: [1, 0],
      duration: 600,
      easing: 'easeInQuad',
      complete: enterObservatory,
    })
  }

  return (
    <div ref={containerRef} className="fixed inset-0" style={{ opacity: 1 }}>
      {/* Three.js star background */}
      <div className="absolute inset-0">
        <Canvas
          camera={{ position: [0, 0, 5], fov: 75 }}
          gl={{ antialias: false, alpha: false }}
          dpr={1}
        >
          <StarField />
        </Canvas>
      </div>

      {/* Scanlines overlay */}
      <div className="scanlines" />

      {/* Content — centered */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">

        {/* Top decorative line */}
        <div
          ref={lineRef}
          style={{
            width: 180,
            height: 1,
            background: 'linear-gradient(90deg, transparent, #4FACFE, transparent)',
            marginBottom: 32,
            opacity: 0,
            transformOrigin: 'center',
          }}
        />

        {/* Observatory label */}
        <p
          className="text-label"
          style={{ marginBottom: 16, letterSpacing: '0.4em', color: 'var(--color-blue)', opacity: 0.7 }}
          ref={subtitleRef}
        >
          {t('start.status')}
        </p>

        {/* Logo */}
        <h1
          ref={logoRef}
          className="text-display glow-blue"
          style={{
            fontSize: 'clamp(2.5rem, 8vw, 6rem)',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            color: 'var(--color-star)',
            lineHeight: 1,
            marginBottom: 12,
            opacity: 0,
          }}
        >
          ASTRO <span style={{ color: 'var(--color-blue)' }}>OBSERVATORY</span>
        </h1>

        {/* Divider */}
        <div className="divider" style={{ width: 240, marginBottom: 24 }} />

        {/* Subtitle */}
        <p
          className="text-mono"
          style={{
            fontSize: '0.875rem',
            color: 'var(--color-grey)',
            letterSpacing: '0.08em',
            marginBottom: 48,
            textAlign: 'center',
            maxWidth: 400,
            opacity: 0,
          }}
          ref={subtitleRef}
        >
          {t('start.subtitle1')}
          <br />{t('start.subtitle2')}
        </p>

        {/* Actions Container — raised above the decorative coordinates line below
            so the (downward-opening) language dropdown stays clickable. */}
        <div ref={btnRef} style={{ opacity: 0, position: 'relative', zIndex: 30, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          {/* ENTER button */}
          <button
            id="enter-observatory-btn"
            className="btn-primary"
            style={{ fontSize: '0.875rem', padding: '14px 40px' }}
            onClick={handleEnter}
          >
            <span>{t('start.enter')}</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Language selector (Custom) */}
          <div className="relative" style={{ width: '140px' }}>
            <button
              onClick={() => setLangOpen(!langOpen)}
              className="text-mono flex items-center justify-between w-full"
              style={{
                background: 'rgba(0, 0, 0, 0.5)',
                color: 'var(--color-grey)',
                border: '1px solid rgba(79, 172, 254, 0.3)',
                padding: '6px 12px',
                borderRadius: '4px',
                fontSize: '0.75rem',
                cursor: 'pointer'
              }}
            >
              <div className="flex items-center gap-2">
                {lang === 'en' ? (
                  <img src="https://flagcdn.com/gb.svg" width="16" alt="UK" style={{ borderRadius: '1px' }} />
                ) : (
                  <img src="https://flagcdn.com/ba.svg" width="16" alt="Bosnia" style={{ borderRadius: '1px' }} />
                )}
                <span>{lang === 'en' ? 'English' : 'Bosanski'}</span>
              </div>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 9l6 6 6-6" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
            
            {langOpen && (
              <div 
                className="absolute top-full left-0 w-full mt-1 flex flex-col overflow-hidden" 
                style={{
                  background: '#0a0a0a',
                  border: '1px solid rgba(79, 172, 254, 0.3)',
                  borderRadius: '4px',
                  zIndex: 10
                }}
              >
                <button
                  onClick={() => { setLanguage('en'); setLangOpen(false); }}
                  className="text-mono flex items-center gap-2 w-full text-left hover:bg-white/5"
                  style={{ padding: '8px 12px', fontSize: '0.75rem', color: 'var(--color-grey)', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'background 0.2s' }}
                >
                  <img src="https://flagcdn.com/gb.svg" width="16" alt="UK" style={{ borderRadius: '1px' }} />
                  English
                </button>
                <button
                  onClick={() => { setLanguage('bs'); setLangOpen(false); }}
                  className="text-mono flex items-center gap-2 w-full text-left hover:bg-white/5"
                  style={{ borderTop: '1px solid rgba(79, 172, 254, 0.1)', padding: '8px 12px', fontSize: '0.75rem', color: 'var(--color-grey)', background: 'transparent', borderBottom: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer', transition: 'background 0.2s' }}
                >
                  <img src="https://flagcdn.com/ba.svg" width="16" alt="Bosnia" style={{ borderRadius: '1px' }} />
                  Bosanski
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bottom coordinates decoration — purely decorative, never intercept
            clicks meant for the language dropdown that can overlap it. */}
        <p
          className="text-label"
          style={{ marginTop: 48, opacity: 0.3, fontSize: '0.6rem', pointerEvents: 'none' }}
        >
          RA 00h 00m 00s · DEC +00° 00′ 00″ · EPOCH J2000.0
        </p>
      </div>

      {/* Corner reticles */}
      <div className="corner-tl" style={{ top: 24, left: 24 }} />
      <div className="corner-tr" style={{ top: 24, right: 24 }} />
      <div className="corner-bl" style={{ bottom: 24, left: 24 }} />
      <div className="corner-br" style={{ bottom: 24, right: 24 }} />
    </div>
  )
}
