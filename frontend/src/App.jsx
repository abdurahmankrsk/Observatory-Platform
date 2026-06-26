/**
 * App.jsx — Root application component.
 * Scene state machine drives which components are mounted.
 * Contains React Error Boundary for 3D scene.
 *
 * State flow:
 *   start → entering → observatory → targeting → flying → viewing
 *                                                              ↓
 *                                               returnToObservatory (→ observatory)
 */
import React, { Component, Suspense } from 'react'
import useObservatoryStore from './store/observatoryStore'

import StartScreen from './components/UI/StartScreen'
import LoadingScreen from './components/UI/LoadingScreen'
import SearchPanel from './components/UI/SearchPanel'
import InfoPanel from './components/UI/InfoPanel'
import CoordinateInput from './components/UI/CoordinateInput'
import OcularView from './components/Camera/OcularView'
import ObservatoryScene from './components/Observatory/ObservatoryScene'
import SpaceScene from './components/Space/SpaceScene'

// ── 3D Error Boundary ──────────────────────────────────────────────────────
class SceneErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[AstroObservatory] 3D Scene Error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 flex flex-col items-center justify-center"
          style={{ background: 'var(--color-void)' }}>
          <div style={{
            padding: 32,
            border: '1px solid rgba(255,107,53,0.3)',
            background: 'rgba(255,107,53,0.05)',
            maxWidth: 480,
            textAlign: 'center',
          }}>
            <p className="text-label" style={{ color: 'var(--color-amber)', marginBottom: 12 }}>
              3D SCENE ERROR
            </p>
            <p style={{ color: 'var(--color-grey)', fontSize: '0.875rem', marginBottom: 20 }}>
              Your device may not support WebGL, or the 3D scene encountered an error.
            </p>
            <p className="text-mono" style={{ color: 'var(--color-dim)', fontSize: '0.75rem', marginBottom: 20 }}>
              {this.state.error?.message ?? 'Unknown error'}
            </p>
            <button
              className="btn-ghost"
              onClick={() => window.location.reload()}
            >
              RELOAD
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ── WebGL Detection ────────────────────────────────────────────────────────
function checkWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    )
  } catch {
    return false
  }
}

// ── Main App ───────────────────────────────────────────────────────────────
function AppContent() {
  const scene = useObservatoryStore((s) => s.scene)
  const isAutoRotating = useObservatoryStore((s) => s.isAutoRotating)
  const toggleAutoRotate = useObservatoryStore((s) => s.toggleAutoRotate)

  // WebGL fallback
  if (!checkWebGL()) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center"
        style={{ background: 'var(--color-void)', padding: 32 }}>
        <h1 className="text-display glow-blue" style={{ fontSize: '2rem', marginBottom: 16 }}>
          ASTRO OBSERVATORY
        </h1>
        <p style={{ color: 'var(--color-grey)', textAlign: 'center', maxWidth: 400 }}>
          AstroObservatory requires WebGL support to render 3D scenes.
          Please use a modern browser (Chrome, Firefox, Edge, or Safari 15+).
        </p>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>

      {/* ── Scene layers ────────────────────────────────────────────── */}

      {/* Start screen */}
      {scene === 'start' && (
        <SceneErrorBoundary>
          <StartScreen />
        </SceneErrorBoundary>
      )}

      {/* Observatory interior (entering + observatory + targeting) */}
      {(scene === 'entering' || scene === 'observatory' || scene === 'targeting') && (
        <SceneErrorBoundary>
          <ObservatoryScene />
        </SceneErrorBoundary>
      )}

      {/* Space scene (flying + viewing) */}
      {(scene === 'flying' || scene === 'viewing') && (
        <SceneErrorBoundary>
          <SpaceScene />
        </SceneErrorBoundary>
      )}

      {/* ── UI overlays (layered on top of 3D) ──────────────────────── */}

      {/* Search panel — observatory only */}
      {(scene === 'observatory' || scene === 'targeting') && <SearchPanel />}

      {/* Coordinate input — observatory only */}
      {scene === 'observatory' && <CoordinateInput />}

      {/* Ocular view overlay — targeting state */}
      {scene === 'targeting' && <OcularView />}

      {/* Info panel — targeting + viewing */}
      {(scene === 'targeting' || scene === 'viewing') && <InfoPanel />}

      {/* Warp loading screen */}
      {scene === 'flying' && <LoadingScreen />}

      {/* ── Global HUD elements ──────────────────────────────────────── */}

      {/* Scanlines (always on) */}
      <div className="scanlines" />

      {/* Corner coordinates display */}
      {scene !== 'start' && (
        <div style={{
          position: 'fixed',
          bottom: 16,
          left: 16,
          zIndex: 30,
        }}>
          <p className="text-label" style={{ color: 'rgba(79,172,254,0.3)', fontSize: '0.55rem' }}>
            ASTRO OBSERVATORY v1.0 · NASA DATA
          </p>
        </div>
      )}

      {/* Auto-Rotate Toggle (bottom-right) */}
      {scene === 'viewing' && (
        <div style={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          zIndex: 30,
        }}>
          <button
            onClick={toggleAutoRotate}
            className="text-label"
            style={{ 
              background: 'rgba(0, 0, 0, 0.5)',
              border: '1px solid rgba(79,172,254,0.3)',
              padding: '6px 12px',
              color: isAutoRotating ? 'var(--color-blue)' : 'var(--color-grey)', 
              cursor: 'pointer',
              borderRadius: '2px',
              transition: 'all 0.2s'
            }}
          >
            ROTATION: {isAutoRotating ? 'ON' : 'OFF'}
          </button>
        </div>
      )}

      {/* Current scene indicator (top-right) */}
      {scene !== 'start' && (
        <div style={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 30,
        }}>
          <p className="text-label" style={{ color: 'rgba(79,172,254,0.4)', fontSize: '0.55rem', textAlign: 'right' }}>
            {scene.toUpperCase()}
          </p>
        </div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'var(--color-void)' }}>
        <div className="spinner" />
      </div>
    }>
      <AppContent />
    </Suspense>
  )
}
