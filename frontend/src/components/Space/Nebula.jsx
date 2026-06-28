/**
 * Nebula — 60,000-100,000 particle volumetric effect.
 * Supports emission (red), reflection (blue), and planetary (green) nebulae.
 * AdditiveBlending for glowing volumetric look.
 */
import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createNoise3D } from 'simplex-noise'

export default function Nebula({ params, position = [0, 0, 0] }) {
  const groupRef = useRef()
  const points1Ref = useRef()
  const points2Ref = useRef()

  const noise3D = useMemo(() => createNoise3D(), [])

  const count = params?.particleCount ?? 70000
  const nebulaRadius = params?.radius ?? 6
  const spread = params?.spread ?? 0.7
  const nebulaStyle = params?.nebulaStyle ?? 'emission'
  const expanding = params?.expanding ?? false       // planetary nebula → shell
  const absorbing = params?.absorbing ?? false       // dark nebula → light-absorbing dust
  const shellThickness = params?.shellThickness ?? 0.3

  const [primary, secondary] = useMemo(() => {
    const p = params?.primaryColor ?? [0.9, 0.15, 0.2]
    const s = params?.secondaryColor ?? [0.7, 0.05, 0.3]
    return [new THREE.Color(...p), new THREE.Color(...s)]
  }, [params])

  // Layer 1 — primary nebula cloud
  const geo1 = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(count * 3)
    const alpha = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      let x, y, z, n
      if (expanding) {
        // Planetary nebula: a thin, slightly clumpy expanding spherical shell.
        const theta = Math.random() * Math.PI * 2
        const phi = Math.acos(2 * Math.random() - 1)
        const r = nebulaRadius * (1 - shellThickness + Math.random() * shellThickness * 2)
        const dx = Math.sin(phi) * Math.cos(theta)
        const dy = Math.cos(phi)
        const dz = Math.sin(phi) * Math.sin(theta)
        x = dx * r
        y = dy * r * 0.85
        z = dz * r
      } else {
        // Emission/reflection/dark: noise-shaped ellipsoidal volume.
        do {
          x = (Math.random() - 0.5) * nebulaRadius * 2
          y = (Math.random() - 0.5) * nebulaRadius * 1.2
          z = (Math.random() - 0.5) * nebulaRadius * 2
          const dist = Math.sqrt(x * x + y * y + z * z)
          n = noise3D(x * 0.3, y * 0.3, z * 0.3) * 0.5 + 0.5
          const falloff = Math.max(0, 1 - dist / nebulaRadius)
          n *= falloff * falloff
        } while (n < Math.random() * spread)
      }

      pos[i * 3] = x
      pos[i * 3 + 1] = y
      pos[i * 3 + 2] = z
      alpha[i] = 0.3 + Math.random() * 0.7
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1))
    return geo
  }, [count, nebulaRadius, spread, expanding, shellThickness])

  // Layer 2 — sparse outer wisps (secondary color)
  const wispCount = Math.floor(count * 0.3)
  const geo2 = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(wispCount * 3)

    for (let i = 0; i < wispCount; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = nebulaRadius * (0.6 + Math.random() * 0.6)

      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.5
      pos[i * 3 + 2] = r * Math.cos(phi)
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return geo
  }, [wispCount, nebulaRadius])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const speed = params?.turbulenceSpeed ?? 0.025
    if (groupRef.current) {
      groupRef.current.rotation.y = t * speed * 0.3
    }
    if (points1Ref.current) {
      points1Ref.current.rotation.z = t * speed * 0.1
    }
    if (points2Ref.current) {
      points2Ref.current.rotation.y = -t * speed * 0.2
    }
  })

  // Dark nebulae absorb starlight rather than emit it: use normal blending and
  // higher opacity so the dust reads as an opaque silhouette, not a glow.
  const blendMode = absorbing ? THREE.NormalBlending : THREE.AdditiveBlending

  return (
    <group ref={groupRef} position={position}>
      {/* Primary nebula cloud */}
      <points ref={points1Ref} geometry={geo1}>
        <pointsMaterial
          color={primary}
          size={absorbing ? 0.12 : 0.06}
          sizeAttenuation
          transparent
          opacity={absorbing ? 0.8 : 0.45}
          blending={blendMode}
          depthWrite={false}
        />
      </points>

      {/* Outer wisps — secondary color */}
      <points ref={points2Ref} geometry={geo2}>
        <pointsMaterial
          color={secondary}
          size={0.1}
          sizeAttenuation
          transparent
          opacity={absorbing ? 0.5 : 0.25}
          blending={blendMode}
          depthWrite={false}
        />
      </points>

      {/* Central glow light — emissive nebulae only */}
      {!absorbing && (
        <pointLight
          color={primary}
          intensity={nebulaStyle === 'planetary' ? 1.2 : 0.8}
          distance={nebulaRadius * 2}
          decay={1}
        />
      )}
    </group>
  )
}
