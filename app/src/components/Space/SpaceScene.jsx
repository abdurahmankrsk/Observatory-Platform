'use client'

/**
 * SpaceScene — The main deep-space 3D scene.
 * Contains:
 *   - Background starfield (10,000 particles)
 *   - Warp speed effect (InstancedMesh line segments)
 *   - Procedural object renderer (picks the right component by type)
 *   - Orbital paths (for exoplanets with orbital data)
 *   - Post-processing (bloom + film grain + vignette)
 *   - OrbitControls for user exploration after arrival
 */
import React, { useRef, useMemo, useEffect, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import * as THREE from 'three'

import useObservatoryStore from '../../store/observatoryStore'
import { useCameraFlight } from '../../hooks/useCameraFlight'
import { useProceduralGen } from '../../hooks/useProceduralGen'
import { computeSceneRadius } from '../../utils/astronomyMath'

import ObjectGenerator from './ObjectGenerator'


// ── Warp Speed Effect ─────────────────────────────────────────────────────
const WARP_LINE_COUNT = 8000

function WarpLines({ active }) {
  const ref = useRef()
  const progressRef = useRef(0)

  const { positions, speeds } = useMemo(() => {
    const pos = new Float32Array(WARP_LINE_COUNT * 6) // 2 points * 3 coords
    const spd = new Float32Array(WARP_LINE_COUNT)

    for (let i = 0; i < WARP_LINE_COUNT; i++) {
      // Random starting position in a sphere
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = 2 + Math.random() * 80

      const x = r * Math.sin(phi) * Math.cos(theta)
      const y = r * Math.sin(phi) * Math.sin(theta)
      const z = r * Math.cos(phi)

      // Both endpoints start at same position
      pos[i * 6 + 0] = x
      pos[i * 6 + 1] = y
      pos[i * 6 + 2] = z
      pos[i * 6 + 3] = x
      pos[i * 6 + 4] = y
      pos[i * 6 + 5] = z

      spd[i] = 0.5 + Math.random() * 1.5
    }

    return { positions: pos, speeds: spd }
  }, [])

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions.slice(), 3))
    return geo
  }, [])

  useFrame((_, delta) => {
    if (!active || !ref.current) return

    progressRef.current = Math.min(progressRef.current + delta * 0.3, 1)
    const stretch = progressRef.current * 6

    const posAttr = geometry.attributes.position
    const arr = posAttr.array

    for (let i = 0; i < WARP_LINE_COUNT; i++) {
      // Origin point stays
      const ox = positions[i * 6 + 0]
      const oy = positions[i * 6 + 1]
      const oz = positions[i * 6 + 2]

      // End point stretched toward camera (-Z direction)
      const s = speeds[i] * stretch
      arr[i * 6 + 0] = ox
      arr[i * 6 + 1] = oy
      arr[i * 6 + 2] = oz
      arr[i * 6 + 3] = ox
      arr[i * 6 + 4] = oy
      arr[i * 6 + 5] = oz - s
    }

    posAttr.needsUpdate = true
  })

  if (!active) return null

  return (
    <lineSegments ref={ref} geometry={geometry}>
      <lineBasicMaterial
        color="#AACCFF"
        transparent
        opacity={0.7}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </lineSegments>
  )
}

// ── Flight Camera Handler ──────────────────────────────────────────────────
function FlightCamera({ frameRadius = 6 }) {
  const { camera } = useThree()
  const { flyIntoObservatory, warpFlight } = useCameraFlight()
  const scene = useObservatoryStore((s) => s.scene)
  const selectedObject = useObservatoryStore((s) => s.selectedObject)
  const arriveAtObject = useObservatoryStore((s) => s.arriveAtObject)

  useEffect(() => {
    if (scene === 'flying' && selectedObject) {
      const dist = selectedObject.distance_ly ?? 10
      // Arrive at ~2.6× the object's extent so it frames nicely on arrival.
      warpFlight(new THREE.Vector3(0, 0, 0), dist, arriveAtObject, frameRadius * 2.6)
    }
  }, [scene, selectedObject])

  return null
}

// ── Main Space Scene Canvas ────────────────────────────────────────────────
export default function SpaceScene() {
  const scene = useObservatoryStore((s) => s.scene)
  const selectedObject = useObservatoryStore((s) => s.selectedObject)
  const isAutoRotating = useObservatoryStore((s) => s.isAutoRotating)
  const isFlying = scene === 'flying'
  const isViewing = scene === 'viewing'

  // Frame the orbit camera around the procedurally-derived extent of the object
  // (disk + jets for a black hole, rings for a giant, etc.) rather than the
  // coarse backend type, so every object class frames sensibly.
  const appearance = useProceduralGen(selectedObject)
  const frameRadius = appearance?.boundingRadius ?? computeSceneRadius(selectedObject)

  return (
    <div className="fixed inset-0">
      <Canvas
        gl={{ antialias: true, alpha: false }}
        camera={{ position: [0, 0, 8], fov: 60, near: 0.01, far: 2000 }}
        dpr={Math.min(window.devicePixelRatio, 2)}
      >
        {/* Background stars */}
        <Stars radius={200} depth={60} count={8000} factor={4} saturation={0.1} fade />

        {/* Ambient light for seeing non-emissive geometry */}
        <ambientLight intensity={0.05} />

        {/* Warp effect during flight */}
        <WarpLines active={isFlying} />

        {/* The celestial object — procedurally generated from its metadata.
            Keyed on the object id so switching objects always remounts the
            generator with fresh geometry/shader uniforms. */}
        {isViewing && selectedObject && (
          <Suspense fallback={null}>
            <ObjectGenerator key={selectedObject.id} object={selectedObject} />
          </Suspense>
        )}

        {/* Camera flight controller */}
        <FlightCamera frameRadius={frameRadius} />

        {/* OrbitControls — only active when viewing */}
        {isViewing && (
          <OrbitControls
            enableZoom={true}
            enablePan={false}
            minDistance={frameRadius * 1.6}
            maxDistance={frameRadius * 6}
            autoRotate={isAutoRotating}
            autoRotateSpeed={0.3}
          />
        )}

        {/* Post-processing effects */}
        <EffectComposer>
          <Bloom
            intensity={isFlying ? 2.5 : 1.0}
            luminanceThreshold={0.2}
            luminanceSmoothing={0.9}
            blendFunction={BlendFunction.SCREEN}
          />
          <Noise opacity={0.0175} blendFunction={BlendFunction.ADD} />
          <Vignette eskil={false} offset={0.1} darkness={isViewing ? 0.5 : 0.8} />
        </EffectComposer>
      </Canvas>
    </div>
  )
}
