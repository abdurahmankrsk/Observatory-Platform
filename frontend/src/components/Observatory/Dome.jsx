/**
 * Dome — Procedural observatory dome.
 *
 * The shell is a TRUE hemisphere of `radius` (matching the wall radius) with a
 * single meridian slit. The old version faked the slit by translating two
 * hemispheres ±2.4 apart, which made the dome bulge ~2.4 units past the walls
 * (the "mushroom" look). Cutting the slit angularly keeps the dome inside the
 * walls.
 *
 * The slit is ONE continuous strip running from one base, over the top, to the
 * opposite base. A naive phi-gap pinches shut at the pole (it reads as two
 * separate slits), so the shell stops just short of the zenith (`thetaTop`),
 * leaving the very top open — the two halves of the strip join through that
 * opening into a single slot.
 *
 * The ENTIRE dome — shell, rings, rails AND the base rim — lives inside the
 * single rotating `domeRef` group, so every part tracks the telescope when an
 * object is selected (previously the base rim sat outside and never moved).
 */
import React, { useMemo, useEffect, useRef } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import useObservatoryStore from '../../store/observatoryStore'

export default function Dome({ radius = 8 }) {
  const domeRef = useRef()
  const telescopeRA = useObservatoryStore((s) => s.telescopeRA)
  const scene       = useObservatoryStore((s) => s.scene)

  // Rotate the whole dome to align the slit with the telescope RA.
  useEffect(() => {
    if (!domeRef.current || scene === 'start' || scene === 'entering') return
    const targetBase = (telescopeRA / 360) * Math.PI * 2
    const currentY = domeRef.current.rotation.y
    let diff = targetBase - currentY
    while (diff >  Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    gsap.to(domeRef.current.rotation, { y: currentY + diff, duration: 2, ease: 'power2.inOut' })
  }, [telescopeRA, scene])

  const slitHalf = 0.26          // half angular width of the slit (rad)
  const thetaTop = 0.14          // shell stops this far short of the pole → open top

  // Two shell pieces leaving the slit open at +Z and -Z, stopping short of the
  // pole so the strip stays open over the top (one continuous slot, not two).
  const shellA = useMemo(() =>
    new THREE.SphereGeometry(radius, 72, 40,
      Math.PI / 2 + slitHalf, Math.PI - 2 * slitHalf, thetaTop, Math.PI / 2 - thetaTop), [radius])
  const shellB = useMemo(() =>
    new THREE.SphereGeometry(radius, 72, 40,
      3 * Math.PI / 2 + slitHalf, Math.PI - 2 * slitHalf, thetaTop, Math.PI / 2 - thetaTop), [radius])

  // Horizontal latitude rings (decorative structural bands).
  const latRings = useMemo(() =>
    [0.18, 0.46].map((t) => {
      const phi = t * Math.PI / 2
      return { r: radius * Math.cos(phi), y: radius * Math.sin(phi) }
    }), [radius])

  // Slit edge rails — half-tori (arc = π) swung about Y so each one traces a
  // full edge of the strip from base, over the open top, to the opposite base.
  const railGeo = useMemo(() =>
    new THREE.TorusGeometry(radius - 0.015, 0.07, 8, 64, Math.PI), [radius])
  const glowGeo = useMemo(() =>
    new THREE.TorusGeometry(radius - 0.05, 0.022, 6, 64, Math.PI), [radius])

  // Ring framing the open top of the slit.
  const capR = radius * Math.sin(thetaTop)
  const capY = radius * Math.cos(thetaTop)

  return (
    <group rotation={[0, Math.PI, 0]}>
      <group ref={domeRef}>
        {/* ── Shell — outer (metallic) + inner (dark) ── */}
        {[shellA, shellB].map((g, i) => (
          <group key={i}>
            <mesh geometry={g} castShadow>
              <meshStandardMaterial color="#1E3248" metalness={0.7} roughness={0.3} side={THREE.FrontSide} />
            </mesh>
            <mesh geometry={g}>
              <meshStandardMaterial color="#0D1C2C" metalness={0.3} roughness={0.78} side={THREE.BackSide} />
            </mesh>
          </group>
        ))}

        {/* ── Horizontal latitude rings ── */}
        {latRings.map((rd, i) => (
          <mesh key={i} position={[0, rd.y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[rd.r, 0.05, 8, 72]} />
            <meshStandardMaterial color="#2E4A66" metalness={0.8} roughness={0.22} />
          </mesh>
        ))}

        {/* ── Slit edge rails + emissive inner glow (frame the single strip) ── */}
        {[slitHalf, -slitHalf].map((off, i) => (
          <group key={`rail-${i}`}>
            <mesh geometry={railGeo} rotation={[0, Math.PI / 2 + off, 0]}>
              <meshStandardMaterial color="#3A5A7A" metalness={0.88} roughness={0.16} />
            </mesh>
            <mesh geometry={glowGeo} rotation={[0, Math.PI / 2 + off, 0]}>
              <meshBasicMaterial color="#5599CC" transparent opacity={0.5} />
            </mesh>
          </group>
        ))}

        {/* ── Ring framing the open top of the slit ── */}
        <mesh position={[0, capY, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[capR, 0.06, 8, 40]} />
          <meshStandardMaterial color="#3A5A7A" metalness={0.85} roughness={0.18} />
        </mesh>

        {/* Slit light pools */}
        <pointLight position={[0, radius * 0.55, radius * 0.45]} color="#4488BB" intensity={0.9} distance={6} decay={2} />
        <pointLight position={[0, radius * 0.55, -radius * 0.45]} color="#4488BB" intensity={0.7} distance={6} decay={2} />

        {/* ── Base rim ring (rotates WITH the dome) ── */}
        <mesh position={[0, 0.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius - 0.06, 0.20, 10, 72]} />
          <meshStandardMaterial color="#2A4060" metalness={0.85} roughness={0.18} />
        </mesh>
        <mesh position={[0, -0.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius - 0.18, 0.07, 8, 72]} />
          <meshStandardMaterial color="#4A6A8A" metalness={0.9} roughness={0.12} />
        </mesh>
      </group>
    </group>
  )
}
