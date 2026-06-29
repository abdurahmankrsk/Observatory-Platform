'use client'

/**
 * SupernovaRemnantGenerator — an expanding shell of shocked gas.
 *
 * Builds a thin spherical shell of particles broken into filaments by 3D noise,
 * colour-coded by emission line (teal [O III], red Hα, orange [S II]) the way
 * real remnants like the Crab or Veil appear. A slow breathing scale + rotation
 * conveys expansion. If the metadata mentions a pulsar/neutron star, a tiny
 * pulsing engine is embedded at the centre (the Crab's heart).
 */
import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createNoise3D } from 'simplex-noise'
import NeutronStarGenerator from './NeutronStarGenerator'

export default function SupernovaRemnantGenerator({ params, position = [0, 0, 0] }) {
  const groupRef = useRef()
  const shellRef = useRef()
  const noise3D = useMemo(() => createNoise3D(), [])

  const radius = params?.radius ?? 5.5
  const thickness = params?.shellThickness ?? 0.2
  const count = params?.particleCount ?? 50000

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)

    const ox = params?.oxygenColor ?? new THREE.Color(0.2, 0.85, 0.75)
    const ha = params?.hydrogenColor ?? new THREE.Color(0.95, 0.2, 0.3)
    const su = params?.sulfurColor ?? new THREE.Color(1.0, 0.55, 0.2)

    let placed = 0
    let guard = 0
    while (placed < count && guard < count * 40) {
      guard++
      // Direction on the sphere, radius near the shell with filamentary breaks.
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const dx = Math.sin(phi) * Math.cos(theta)
      const dy = Math.cos(phi)
      const dz = Math.sin(phi) * Math.sin(theta)

      // Filament mask: keep particles where noise is high → wispy ridges.
      const n = noise3D(dx * 2.2, dy * 2.2, dz * 2.2) * 0.5 + 0.5
      if (n < 0.45 + Math.random() * 0.25) continue

      const rr = radius * (1 - thickness + Math.random() * thickness * 2)
      const i = placed
      pos[i * 3] = dx * rr
      pos[i * 3 + 1] = dy * rr
      pos[i * 3 + 2] = dz * rr

      // Colour by a second noise field so the three species form distinct regions.
      const m = noise3D(dx * 3.5 + 11, dy * 3.5 + 7, dz * 3.5 + 3) * 0.5 + 0.5
      const c = m < 0.4 ? ox : m < 0.7 ? su : ha
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
      placed++
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, placed * 3), 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors.subarray(0, placed * 3), 3))
    return geo
  }, [count, radius, thickness, params, noise3D])

  // Synthesise a compact pulsar engine for the centre when relevant.
  const pulsarParams = useMemo(() => {
    if (!params?.centralPulsar) return null
    return {
      radius: radius * 0.05,
      coreColor: new THREE.Color(0.8, 0.9, 1.0),
      glowColor: new THREE.Color(0.6, 0.8, 1.0),
      beamColor: new THREE.Color(0.8, 0.9, 1.0),
      beams: true, jets: false, pulse: true, pulseSpeed: 12,
      magneticField: false, particleEffects: false,
      rotationSpeed: 8, glowIntensity: 2.5,
    }
  }, [params, radius])

  useFrame((s) => {
    const t = s.clock.elapsedTime
    if (groupRef.current) groupRef.current.rotation.y = t * 0.03
    if (shellRef.current) {
      // Gentle breathing to read as ongoing expansion.
      const e = 1 + 0.04 * Math.sin(t * (params?.expansionSpeed ?? 0.05) * 8)
      shellRef.current.scale.setScalar(e)
    }
  })

  return (
    <group ref={groupRef} position={position}>
      <points ref={shellRef} geometry={geometry}>
        <pointsMaterial
          size={0.06}
          sizeAttenuation
          vertexColors
          transparent
          opacity={0.7}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {pulsarParams && <NeutronStarGenerator params={pulsarParams} />}

      <pointLight color={params?.oxygenColor ?? new THREE.Color(0.4, 0.8, 0.8)} intensity={0.6} distance={radius * 3} decay={1.5} />
    </group>
  )
}
