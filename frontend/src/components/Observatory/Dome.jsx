/**
 * Dome — Procedural observatory dome.
 *
 * The shell is a TRUE hemisphere of `radius` (matching the wall radius) with a
 * meridian slit cut out by leaving angular gaps in the sphere geometry. The old
 * version faked the slit by translating two hemispheres ±2.4 apart, which made
 * the dome bulge ~2.4 units past the walls (the "mushroom" look). Cutting the
 * slit angularly keeps the dome inside the walls.
 *
 * The ENTIRE dome — shell, ribs, latitude rings AND the base rim — lives inside
 * the single rotating `domeRef` group, so every ring tracks the telescope when
 * an object is selected (previously the base rim sat outside and never moved).
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

  // Half angular width of the slit (rad). Centred on the Z axis so the strip
  // runs from one base, over the zenith, to the opposite base.
  const slitHalf = 0.26

  // Two shell pieces leaving the slit open at +Z and -Z. No translation → the
  // dome stays a clean hemisphere of `radius` and never overhangs the walls.
  const shellA = useMemo(() =>
    new THREE.SphereGeometry(radius, 64, 40,
      Math.PI / 2 + slitHalf, Math.PI - 2 * slitHalf, 0, Math.PI / 2), [radius])
  const shellB = useMemo(() =>
    new THREE.SphereGeometry(radius, 64, 40,
      3 * Math.PI / 2 + slitHalf, Math.PI - 2 * slitHalf, 0, Math.PI / 2), [radius])

  // Horizontal latitude rings (decorative structural bands).
  const latRings = useMemo(() =>
    [0.16, 0.42, 0.68].map((t) => {
      const phi = t * Math.PI / 2
      return { r: radius * Math.cos(phi), y: radius * Math.sin(phi) }
    }), [radius])

  // Meridian ribs framing the two slit edges — half-tori (arc = π) swung about
  // Y so they sweep from base, over the zenith, to the opposite base.
  const ribGeo = useMemo(() =>
    new THREE.TorusGeometry(radius - 0.015, 0.07, 8, 60, Math.PI), [radius])
  const glowRibGeo = useMemo(() =>
    new THREE.TorusGeometry(radius - 0.06, 0.025, 6, 60, Math.PI), [radius])

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

        {/* ── Vertical structural ribs spread around the closed part of the shell ── */}
        {[0.6, 1.05, 1.5, 1.95, 2.4, -0.6, -1.05, -1.5, -1.95, -2.4].map((a, i) => (
          <mesh key={`rib-${i}`} geometry={ribGeo} rotation={[0, Math.PI / 2 + a, 0]}>
            <meshStandardMaterial color="#26405A" metalness={0.75} roughness={0.28} />
          </mesh>
        ))}

        {/* ── Slit edge rails (heavier) + emissive inner glow ── */}
        {[slitHalf, -slitHalf].map((off, i) => (
          <group key={`rail-${i}`}>
            <mesh geometry={ribGeo} rotation={[0, Math.PI / 2 + off * 1.0, 0]} scale={[1, 1, 1]}>
              <meshStandardMaterial color="#3A5A7A" metalness={0.88} roughness={0.16} />
            </mesh>
            <mesh geometry={glowRibGeo} rotation={[0, Math.PI / 2 + off * 0.78, 0]}>
              <meshBasicMaterial color="#5599CC" transparent opacity={0.5} />
            </mesh>
          </group>
        ))}

        {/* Slit edge light pools */}
        <pointLight position={[0, radius * 0.55, radius * 0.45]} color="#4488BB" intensity={0.9} distance={6} decay={2} />
        <pointLight position={[0, radius * 0.55, -radius * 0.45]} color="#4488BB" intensity={0.7} distance={6} decay={2} />

        {/* ── Base rim ring (now rotates WITH the dome) ── */}
        <mesh position={[0, 0.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius - 0.06, 0.20, 10, 72]} />
          <meshStandardMaterial color="#2A4060" metalness={0.85} roughness={0.18} />
        </mesh>
        <mesh position={[0, -0.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius - 0.18, 0.07, 8, 72]} />
          <meshStandardMaterial color="#4A6A8A" metalness={0.9} roughness={0.12} />
        </mesh>

        {/* ── Zenith cap disc ── */}
        <mesh position={[0, radius - 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.4, 24]} />
          <meshStandardMaterial color="#4A6A8A" metalness={0.9} roughness={0.12} />
        </mesh>
      </group>
    </group>
  )
}
