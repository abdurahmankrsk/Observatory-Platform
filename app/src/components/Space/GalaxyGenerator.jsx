'use client'

/**
 * GalaxyGenerator — procedural galaxy supporting three morphologies:
 *   - spiral:    logarithmic arms + hot core → cool disk gradient + dust lanes,
 *   - elliptical: smooth triaxial ellipsoid of old (red/yellow) stars,
 *   - irregular: chaotic noise-clumped star cloud with patchy star formation.
 *
 * Replaces the inline Galaxy that previously lived in SpaceScene and adds the
 * non-spiral classes the classifier can now distinguish.
 */
import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createNoise3D } from 'simplex-noise'

function buildSpiral(params, noise3D) {
  const count = params?.particleCount ?? 28000
  const arms = params?.spiralArms ?? 3
  const radius = params?.radius ?? 7
  const armSpin = params?.armSpin ?? 1.5
  const armWidth = params?.armWidth ?? 0.35
  const dustLanes = params?.dustLanes ?? true

  const geo = new THREE.BufferGeometry()
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const coreColor = new THREE.Color(...(params?.coreColor ?? [1, 0.85, 0.5]))
  const diskColor = new THREE.Color(...(params?.diskColor ?? [0.55, 0.65, 0.95]))

  // A fraction of stars form a dense, bright central bulge so the core reads as
  // full rather than a thin spindle. The rest populate the spiral arms.
  const bulgeCount = Math.floor(count * 0.32)
  const gaussian = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5

  for (let i = 0; i < count; i++) {
    let x, y, z, r
    if (i < bulgeCount) {
      // Flattened spheroidal bulge concentrated at the centre.
      const br = radius * 0.22
      x = gaussian() * br
      z = gaussian() * br
      y = gaussian() * br * 0.55
      r = Math.sqrt(x * x + z * z)
    } else {
      const arm = Math.floor(Math.random() * arms)
      const armAngle = (arm / arms) * Math.PI * 2
      r = Math.pow(Math.random(), 0.5) * radius
      const spinAngle = r * armSpin
      const scatter = (Math.random() - 0.5) * r * armWidth
      const angle = armAngle + spinAngle
      x = (r + scatter) * Math.cos(angle) + (Math.random() - 0.5) * 0.5
      y = (Math.random() - 0.5) * 0.3 * (1 - r / radius) + (Math.random() - 0.5) * 0.1
      z = (r + scatter) * Math.sin(angle) + (Math.random() - 0.5) * 0.5
    }
    positions[i * 3] = x
    positions[i * 3 + 1] = y
    positions[i * 3 + 2] = z

    const coreBlend = Math.max(0, 1 - r / (radius * 0.35))
    const c = diskColor.clone().lerp(coreColor, coreBlend)
    // Dust lanes: darken a fraction of disk stars along the arms (not the bulge).
    if (dustLanes && i >= bulgeCount) {
      const d = noise3D(x * 0.5, y * 0.5, z * 0.5) * 0.5 + 0.5
      if (d < 0.35 && r > radius * 0.25) c.multiplyScalar(0.35)
    }
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geo
}

// Gaussian-ish sample via averaging — smooth central concentration.
function gauss() {
  return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5
}

function buildElliptical(params) {
  const count = params?.particleCount ?? 28000
  const radius = params?.radius ?? 7
  const geo = new THREE.BufferGeometry()
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const core = new THREE.Color(1.0, 0.9, 0.65)
  const edge = new THREE.Color(0.8, 0.55, 0.4)
  // Triaxial axis ratios.
  const ax = 1.0, ay = 0.7, az = 0.85
  for (let i = 0; i < count; i++) {
    const x = gauss() * radius * 0.5 * ax
    const y = gauss() * radius * 0.5 * ay
    const z = gauss() * radius * 0.5 * az
    positions[i * 3] = x
    positions[i * 3 + 1] = y
    positions[i * 3 + 2] = z
    const dist = Math.sqrt(x * x + y * y + z * z) / radius
    const c = core.clone().lerp(edge, Math.min(dist * 1.4, 1))
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geo
}

function buildIrregular(params, noise3D) {
  const count = params?.particleCount ?? 22000
  const radius = params?.radius ?? 7
  const geo = new THREE.BufferGeometry()
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const young = new THREE.Color(0.6, 0.75, 1.0)  // blue star-forming knots
  const old = new THREE.Color(1.0, 0.85, 0.6)
  let placed = 0, guard = 0
  while (placed < count && guard < count * 30) {
    guard++
    const x = (Math.random() - 0.5) * radius * 2
    const y = (Math.random() - 0.5) * radius * 1.0
    const z = (Math.random() - 0.5) * radius * 2
    const n = noise3D(x * 0.35, y * 0.35, z * 0.35) * 0.5 + 0.5
    const dist = Math.sqrt(x * x + y * y + z * z) / radius
    if (n * (1 - dist * 0.6) < 0.35 + Math.random() * 0.3) continue
    const i = placed
    positions[i * 3] = x
    positions[i * 3 + 1] = y
    positions[i * 3 + 2] = z
    const c = (n > 0.7 ? young : old).clone()
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
    placed++
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions.subarray(0, placed * 3), 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors.subarray(0, placed * 3), 3))
  return geo
}

export default function GalaxyGenerator({ params, position = [0, 0, 0] }) {
  const groupRef = useRef()
  const noise3D = useMemo(() => createNoise3D(), [])
  const cls = params?.galaxyClass ?? 'spiral'

  const geometry = useMemo(() => {
    if (cls === 'elliptical') return buildElliptical(params)
    if (cls === 'irregular') return buildIrregular(params, noise3D)
    return buildSpiral(params, noise3D)
  }, [cls, params, noise3D])

  useFrame((state) => {
    if (!groupRef.current) return
    // Ellipticals barely rotate; spirals/irregulars spin slowly.
    groupRef.current.rotation.y = state.clock.elapsedTime * (cls === 'elliptical' ? 0.003 : 0.01)
    groupRef.current.rotation.x = params?.tiltAngle ?? 0.4
  })

  return (
    <group ref={groupRef} position={position}>
      <points geometry={geometry}>
        <pointsMaterial
          size={cls === 'elliptical' ? 0.065 : 0.055}
          sizeAttenuation
          vertexColors
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
      {/* Core glow */}
      <pointLight color={new THREE.Color(1, 0.9, 0.7)} intensity={0.6} distance={(params?.radius ?? 7) * 2} decay={1.5} />
    </group>
  )
}
