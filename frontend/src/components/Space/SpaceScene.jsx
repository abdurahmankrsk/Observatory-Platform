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
import { useProceduralGen } from '../../hooks/useProceduralGen'
import { useCameraFlight } from '../../hooks/useCameraFlight'
import { computeSceneRadius } from '../../utils/astronomyMath'

import ProceduralPlanet from './ProceduralPlanet'
import ProceduralAsteroid from './ProceduralAsteroid'
import Star from './Star'
import Nebula from './Nebula'
import OrbitalPath from './OrbitalPath'


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

// ── Galaxy Renderer ────────────────────────────────────────────────────────
function Galaxy({ params, position = [0, 0, 0] }) {
  const groupRef = useRef()
  const count = params?.particleCount ?? 80000
  const arms = params?.spiralArms ?? 3
  const radius = params?.radius ?? 7
  const armSpin = params?.armSpin ?? 1.5
  const armWidth = params?.armWidth ?? 0.35

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)

    const coreColor = new THREE.Color(...(params?.coreColor ?? [1, 0.85, 0.5]))
    const diskColor = new THREE.Color(...(params?.diskColor ?? [0.55, 0.65, 0.95]))

    for (let i = 0; i < count; i++) {
      // Assign to an arm
      const arm = Math.floor(Math.random() * arms)
      const armAngle = (arm / arms) * Math.PI * 2

      // Radial distance — concentrate near center
      const r = Math.pow(Math.random(), 0.5) * radius
      const spinAngle = r * armSpin
      const scatter = (Math.random() - 0.5) * r * armWidth

      const angle = armAngle + spinAngle
      const x = (r + scatter) * Math.cos(angle) + (Math.random() - 0.5) * 0.5
      const y = (Math.random() - 0.5) * 0.3 * (1 - r / radius) + (Math.random() - 0.5) * 0.1
      const z = (r + scatter) * Math.sin(angle) + (Math.random() - 0.5) * 0.5

      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z

      // Color: hot core → cool disk
      const coreBlend = Math.max(0, 1 - r / (radius * 0.3))
      const c = diskColor.clone().lerp(coreColor, coreBlend)
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return geo
  }, [count, arms, radius, armSpin, armWidth, params])

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.01
      groupRef.current.rotation.x = params?.tiltAngle ?? 0.4
    }
  })

  return (
    <group ref={groupRef} position={position}>
      <points geometry={geometry}>
        <pointsMaterial
          size={0.04}
          sizeAttenuation
          vertexColors
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </group>
  )
}

// ── Object Switcher ────────────────────────────────────────────────────────
function CelestialObjectRenderer({ object }) {
  const params = useProceduralGen(object)

  if (!object || !params) return null

  switch (object.type) {
    case 'planet':
    case 'exoplanet':
      return (
        <group>
          <ProceduralPlanet params={params} position={[0, 0, 0]} />
          {object.exoplanet?.semi_major_axis_au && (
            <OrbitalPath
              semiMajorAxis={object.exoplanet.semi_major_axis_au}
              eccentricity={0.05}
              scale={1.5}
              color="#4FACFE"
              opacity={0.2}
            />
          )}
        </group>
      )
    case 'asteroid':
      return <ProceduralAsteroid params={params} position={[0, 0, 0]} />
    case 'star':
      return <Star params={params} position={[0, 0, 0]} />
    case 'nebula':
      return <Nebula params={params} position={[0, 0, 0]} />
    case 'galaxy':
      return <Galaxy params={params} position={[0, 0, 0]} />
    default:
      return <ProceduralPlanet params={params} position={[0, 0, 0]} />
  }
}

// ── Flight Camera Handler ──────────────────────────────────────────────────
function FlightCamera() {
  const { camera } = useThree()
  const { flyIntoObservatory, warpFlight } = useCameraFlight()
  const scene = useObservatoryStore((s) => s.scene)
  const selectedObject = useObservatoryStore((s) => s.selectedObject)
  const arriveAtObject = useObservatoryStore((s) => s.arriveAtObject)

  useEffect(() => {
    if (scene === 'flying' && selectedObject) {
      const dist = selectedObject.distance_ly ?? 10
      warpFlight(new THREE.Vector3(0, 0, 0), dist, arriveAtObject)
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

        {/* The celestial object */}
        {isViewing && selectedObject && (
          <Suspense fallback={null}>
            <CelestialObjectRenderer object={selectedObject} />
          </Suspense>
        )}

        {/* Camera flight controller */}
        <FlightCamera />

        {/* OrbitControls — only active when viewing */}
        {isViewing && (
          <OrbitControls
            enableZoom={true}
            enablePan={false}
            minDistance={computeSceneRadius(selectedObject) * 2.0}
            maxDistance={computeSceneRadius(selectedObject) * 8}
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
