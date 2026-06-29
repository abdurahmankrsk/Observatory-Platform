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

      let px, py, pz, isCore;
      
      if (params?.isTunnel) {
        // Map to a long twisting cylindrical tunnel (solid, much thinner)
        const t = (Math.random() - 0.5) * 2; // -1 to 1
        const angle = Math.random() * Math.PI * 2;
        
        // Fill the volume of the cylinder (pow 0.5 for uniform density)
        const rNorm = Math.pow(Math.random(), 0.5);
        px = t * radius * 2.8;
        
        // Determine color region radially (core vs spillover edge)
        // We use px to generate some boundary noise
        const boundaryNoise = noise3D(px * 1.5, 0, 0) * 0.3;
        isCore = (rNorm + boundaryNoise) < 0.6; // more blue in the center
        
        // Randomly reject a large portion of the pink particles to make the spillover sparser
        if (!isCore && Math.random() < 0.65) continue;
        
        // Taper the ends so it pinches sharply like a pencil
        const taper = 1.0 - Math.pow(Math.abs(t), 2.0); // 1 in middle, 0 at ends
        
        // Spillover particles expand outwards much further than the tight core
        const spreadMult = isCore ? 1.0 : 1.8 + Math.random() * 0.8;
        
        const maxTubeRadius = radius * 0.12 * taper * spreadMult;
        const tubeRadius = rNorm * maxTubeRadius;
        
        py = Math.cos(angle) * tubeRadius;
        pz = Math.sin(angle) * tubeRadius;
        
        // Add a gentle macroscopic twist/bend to the tunnel
        py += Math.sin(t * 3.0) * radius * 0.25;
        pz += Math.cos(t * 2.5) * radius * 0.25;
        
        // Mask out parts of the tunnel based on noise to create wispy gaps
        const n = noise3D(px * 0.6, py * 0.6, pz * 0.6) * 0.5 + 0.5;
        if (n < 0.35) continue;
      } else {
        // Standard spherical shell mapping
        // Optional shape constraints to create arcs or bands instead of a full sphere
        if (params?.flattenY && Math.abs(dy) > params.flattenY) continue
        if (params?.arcMask && dx < -0.2) continue

        // Filament mask: keep particles where noise is high → wispy ridges.
        const nx = dx * (params?.noiseScaleX ?? 2.2)
        const ny = dy * (params?.noiseScaleY ?? 2.2)
        const nz = dz * (params?.noiseScaleZ ?? 2.2)
        const n = noise3D(nx, ny, nz) * 0.5 + 0.5
        if (n < 0.45 + Math.random() * 0.25) continue
        
        const rr = radius * (1 - thickness + Math.random() * thickness * 2)
        px = dx * rr;
        py = dy * rr;
        pz = dz * rr;
      }

      const i = placed
      pos[i * 3] = px
      pos[i * 3 + 1] = py
      pos[i * 3 + 2] = pz

      // Colour by a second noise field so the three species form distinct regions.
      let c;
      if (params?.isTunnel) {
        c = isCore ? ox : (Math.random() > 0.5 ? ha : su);
      } else {
        const m = noise3D(px * 1.2 + 11, py * 1.2 + 7, pz * 1.2 + 3) * 0.5 + 0.5
        c = m < 0.4 ? ox : m < 0.7 ? su : ha
      }
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
