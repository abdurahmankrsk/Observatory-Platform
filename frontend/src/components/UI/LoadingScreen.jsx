/**
 * LoadingScreen — Shown during warp flight.
 * Animated distance counter + warp status messages.
 */
import React, { useEffect, useRef, useState } from 'react'
import anime from 'animejs'
import useObservatoryStore from '../../store/observatoryStore'
import { formatDistance } from '../../utils/astronomyMath'

const WARP_MESSAGES = [
  'CALCULATING TRAJECTORY...',
  'ENGAGING WARP DRIVE...',
  'CROSSING INTERSTELLAR VOID...',
  'APPROACHING TARGET SYSTEM...',
  'DECELERATING...',
  'ACHIEVING STABLE ORBIT...',
]

export default function LoadingScreen() {
  const selectedObject = useObservatoryStore((s) => s.selectedObject)
  const containerRef = useRef()
  const progressRef = useRef()
  const [msgIndex, setMsgIndex] = useState(0)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    // Cycle through warp messages
    let i = 0
    const interval = setInterval(() => {
      i = (i + 1) % WARP_MESSAGES.length
      setMsgIndex(i)
    }, 1200)

    // Animate progress bar
    const progObj = { val: 0 }
    anime({
      targets: progObj,
      val: 100,
      duration: 6000,
      easing: 'easeInOutExpo',
      update: () => setProgress(Math.floor(progObj.val)),
    })

    // Entrance animation
    anime({
      targets: containerRef.current,
      opacity: [0, 1],
      duration: 300,
      easing: 'linear',
    })

    return () => {
      clearInterval(interval)
    }
  }, [])

  const dist = selectedObject ? formatDistance(selectedObject) : '---'

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 flex flex-col items-center justify-center"
      style={{
        background: 'rgba(1,10,20,0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 50,
        opacity: 0,
      }}
    >
      {/* Reticle crosshair */}
      <div style={{ position: 'relative', width: 120, height: 120, marginBottom: 32 }}>
        {/* Outer ring */}
        <div style={{
          position: 'absolute', inset: 0,
          border: '1px solid rgba(79,172,254,0.3)',
          borderRadius: '50%',
          animation: 'spin 4s linear infinite',
        }} />
        {/* Inner ring */}
        <div style={{
          position: 'absolute', inset: 16,
          border: '1px solid rgba(79,172,254,0.6)',
          borderRadius: '50%',
          animation: 'spin 2s linear infinite reverse',
        }} />
        {/* Cross */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '100%', height: 1, background: 'rgba(79,172,254,0.4)' }} />
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ height: '100%', width: 1, background: 'rgba(79,172,254,0.4)' }} />
        </div>
        {/* Center dot */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            width: 8, height: 8,
            borderRadius: '50%',
            background: 'var(--color-blue)',
            boxShadow: '0 0 12px var(--color-blue)',
          }} />
        </div>
      </div>

      {/* Target name */}
      {selectedObject && (
        <h2 className="text-display" style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          color: 'var(--color-star)',
          marginBottom: 8,
          letterSpacing: '-0.02em',
        }}>
          {selectedObject.name}
        </h2>
      )}

      {/* Distance */}
      <p className="text-mono" style={{ color: 'var(--color-blue)', fontSize: '0.875rem', marginBottom: 32 }}>
        {dist}
      </p>

      {/* Warp status message */}
      <p className="text-label" style={{ color: 'var(--color-grey)', marginBottom: 24, minHeight: 20 }}>
        {WARP_MESSAGES[msgIndex]}
      </p>

      {/* Progress bar */}
      <div style={{
        width: 280,
        height: 2,
        background: 'rgba(79,172,254,0.15)',
        borderRadius: 1,
        overflow: 'hidden',
      }}>
        <div ref={progressRef} style={{
          height: '100%',
          width: `${progress}%`,
          background: 'linear-gradient(90deg, var(--color-blue), var(--color-glow))',
          boxShadow: '0 0 8px var(--color-blue)',
          transition: 'width 0.1s linear',
        }} />
      </div>

      <p className="text-mono" style={{ color: 'var(--color-dim)', fontSize: '0.7rem', marginTop: 12 }}>
        {progress}%
      </p>
    </div>
  )
}
