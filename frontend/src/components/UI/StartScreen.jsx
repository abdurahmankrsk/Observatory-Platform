/**
 * StartScreen — The first thing the user sees.
 * Particle star background (Three.js Canvas) + logo + ENTER button.
 * Anime.js entrance animation on mount.
 */
import React, { useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import anime from 'animejs'
import useObservatoryStore from '../../store/observatoryStore'

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
          SYSTEM ONLINE · COORDINATES LOCKED
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
          ASTRO<span style={{ color: 'var(--color-blue)' }}>OBSERVATORY</span>
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
          Explore exoplanets, stars, nebulae, and asteroids
          <br />powered by real NASA data
        </p>

        {/* ENTER button */}
        <button
          ref={btnRef}
          id="enter-observatory-btn"
          className="btn-primary"
          style={{ fontSize: '0.875rem', opacity: 0, padding: '14px 40px' }}
          onClick={handleEnter}
        >
          <span>ENTER OBSERVATORY</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Bottom coordinates decoration */}
        <p
          className="text-label"
          style={{ marginTop: 48, opacity: 0.3, fontSize: '0.6rem' }}
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
