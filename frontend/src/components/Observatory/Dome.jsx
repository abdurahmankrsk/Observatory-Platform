/**
 * Dome — Procedural observatory dome geometry.
 * Upgraded: more metallic materials, shutter rail strips along slit edges,
 * rim junction ring at base, subtle emissive slit edges.
 */
import React, { useMemo, useEffect, useRef } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import useObservatoryStore from '../../store/observatoryStore'

export default function Dome({ radius = 8, openingAngle = 0.3 }) {
  const domeRef = useRef()
  const telescopeRA = useObservatoryStore((s) => s.telescopeRA)
  const scene       = useObservatoryStore((s) => s.scene)

  // Rotate dome to align slit with telescope RA
  useEffect(() => {
    if (!domeRef.current || scene === 'start' || scene === 'entering') return
    const targetBase = (telescopeRA / 360) * Math.PI * 2

    const currentY = domeRef.current.rotation.y
    let diff = targetBase - currentY
    while (diff >  Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2

    gsap.to(domeRef.current.rotation, { y: currentY + diff, duration: 2, ease: 'power2.inOut' })
  }, [telescopeRA, scene])

  const gapWidth = 4.8
  const halfGap  = gapWidth / 2

  // Two hemisphere halves leaving the slit open
  const rightHemisphere = useMemo(() =>
    new THREE.SphereGeometry(radius, 48, 32, Math.PI / 2, Math.PI, 0, Math.PI / 2), [radius])
  const leftHemisphere  = useMemo(() =>
    new THREE.SphereGeometry(radius, 48, 32, -Math.PI / 2, Math.PI, 0, Math.PI / 2), [radius])

  // Back filler panel
  const backFiller = useMemo(() =>
    new THREE.CylinderGeometry(radius - 0.05, radius - 0.05, gapWidth, 48, 1, true,
      Math.PI / 2 + 0.15, Math.PI / 2 - 0.15), [radius, gapWidth])

  // ── Shutter rail geometry ─────────────────────────────────────────────────
  // Two vertical curved strips along the slit edges.
  // We approximate with tall thin boxes at x = ±halfGap.
  const slitHeight = radius * 1.05   // slightly taller than the slit
  const railWidth  = 0.22
  const railDepth  = 0.18

  return (
    <group rotation={[0, Math.PI, 0]}>
      {/* ── Base rim ring — sits inside the wall, flush against it ── */}
      <mesh position={[0, -0.06, 0]}>
        <torusGeometry args={[7.6, 0.20, 10, 64]} />
        <meshStandardMaterial color="#2A4060" metalness={0.85} roughness={0.18} />
      </mesh>
      {/* Inner rim trim */}
      <mesh position={[0, -0.20, 0]}>
        <torusGeometry args={[7.4, 0.07, 8, 64]} />
        <meshStandardMaterial color="#4A6A8A" metalness={0.9} roughness={0.12} />
      </mesh>

      <group ref={domeRef}>
        {/* ── Right hemisphere shell ── */}
        <mesh geometry={rightHemisphere} position={[halfGap, 0, 0]}>
          <meshStandardMaterial color="#1E3248" metalness={0.65} roughness={0.32} side={THREE.FrontSide} />
        </mesh>
        <mesh geometry={rightHemisphere} position={[halfGap, 0, 0]}>
          <meshStandardMaterial color="#0D1C2C" metalness={0.3} roughness={0.75} side={THREE.BackSide} />
        </mesh>

        {/* ── Left hemisphere shell ── */}
        <mesh geometry={leftHemisphere} position={[-halfGap, 0, 0]}>
          <meshStandardMaterial color="#1E3248" metalness={0.65} roughness={0.32} side={THREE.FrontSide} />
        </mesh>
        <mesh geometry={leftHemisphere} position={[-halfGap, 0, 0]}>
          <meshStandardMaterial color="#0D1C2C" metalness={0.3} roughness={0.75} side={THREE.BackSide} />
        </mesh>

        {/* ── Back filler ── */}
        <mesh geometry={backFiller} position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <meshStandardMaterial color="#1E3248" metalness={0.65} roughness={0.32} side={THREE.DoubleSide} />
        </mesh>

        {/* ── Dome latitude rings (decorative structural bands) ── */}
        {[0.15, 0.45, 0.75].map((t, i) => {
          // At parametric angle phi along the dome from equator to zenith
          const phi = t * Math.PI / 2
          const ringR = radius * Math.cos(phi)
          const ringY = radius * Math.sin(phi)
          return (
            <mesh key={i} position={[0, ringY, 0]}>
              <torusGeometry args={[ringR, 0.055, 8, 64]} />
              <meshStandardMaterial color="#2E4A66" metalness={0.80} roughness={0.22} />
            </mesh>
          )
        })}

        {/* ── Shutter rail — right edge of slit ── */}
        <group position={[halfGap, slitHeight * 0.42, 0]}>
          <mesh>
            <boxGeometry args={[railWidth, slitHeight * 0.88, railDepth]} />
            <meshStandardMaterial color="#3A5A7A" metalness={0.85} roughness={0.18} />
          </mesh>
          {/* Emissive inner glow strip */}
          <mesh position={[-railWidth / 2 + 0.01, 0, 0]}>
            <boxGeometry args={[0.03, slitHeight * 0.82, 0.04]} />
            <meshBasicMaterial color="#5599CC" transparent opacity={0.55} />
          </mesh>
          <pointLight position={[-railWidth * 2, 0, 0]} color="#4488BB" intensity={0.8} distance={5} decay={2} />
        </group>

        {/* ── Shutter rail — left edge of slit ── */}
        <group position={[-halfGap, slitHeight * 0.42, 0]}>
          <mesh>
            <boxGeometry args={[railWidth, slitHeight * 0.88, railDepth]} />
            <meshStandardMaterial color="#3A5A7A" metalness={0.85} roughness={0.18} />
          </mesh>
          {/* Emissive inner glow strip */}
          <mesh position={[railWidth / 2 - 0.01, 0, 0]}>
            <boxGeometry args={[0.03, slitHeight * 0.82, 0.04]} />
            <meshBasicMaterial color="#5599CC" transparent opacity={0.55} />
          </mesh>
          <pointLight position={[railWidth * 2, 0, 0]} color="#4488BB" intensity={0.8} distance={5} decay={2} />
        </group>

        {/* ── Slit top cross-bar ── */}
        <mesh position={[0, slitHeight * 0.88, 0]}>
          <boxGeometry args={[gapWidth + railWidth, railWidth, railDepth]} />
          <meshStandardMaterial color="#3A5A7A" metalness={0.85} roughness={0.18} />
        </mesh>

        {/* ── Zenith cap disc ── */}
        <mesh position={[0, radius, 0]}>
          <circleGeometry args={[0.35, 24]} />
          <meshStandardMaterial color="#4A6A8A" metalness={0.9} roughness={0.12} />
        </mesh>
      </group>
    </group>
  )
}
