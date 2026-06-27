/**
 * Dome — Procedural observatory dome.
 *
 * The shell is a TRUE hemisphere of `radius` (matching the wall radius, so the
 * dome never overhangs the walls) with a single REAL observatory slit: a
 * constant-width vertical slot on ONE side, running from the base up to a
 * rounded top near the apex. The back of the dome stays closed.
 *
 * A phi-gap on a sphere tapers to a point (triangular), so the slot is built as
 * custom geometry: every latitude ring keeps the arc OUTSIDE a fixed linear
 * half-width `slotHalf` in x, which makes both slot edges land exactly on the
 * planes x = ±slotHalf — straight, parallel, constant-width edges. A small solid
 * cap closes the very top, giving the slot a rounded crown.
 *
 * The whole dome lives in the single rotating `domeRef` group so the slot tracks
 * the telescope when an object is selected.
 */
import React, { useMemo, useEffect, useRef } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import useObservatoryStore from '../../store/observatoryStore'

// Hemisphere with a constant-width, one-sided slot (open near +Z, base→top).
function makeSlottedBand(R, w, thetaStart, thetaSegs, phiSegs) {
  const pos = [], idx = [], rings = []
  for (let i = 0; i <= thetaSegs; i++) {
    const theta = thetaStart + (i / thetaSegs) * (Math.PI / 2 - thetaStart)
    const ringR = R * Math.sin(theta)
    const y = R * Math.cos(theta)
    // Remove the front arc where |x| <= w  (x = ringR * sin(phi), phi=0 at +Z).
    const phiLim = ringR > w ? Math.asin(Math.min(1, w / ringR)) : Math.PI / 2
    const ring = []
    for (let j = 0; j <= phiSegs; j++) {
      const phi = phiLim + (j / phiSegs) * (2 * Math.PI - 2 * phiLim)
      ring.push(pos.length / 3)
      pos.push(ringR * Math.sin(phi), y, ringR * Math.cos(phi))
    }
    rings.push(ring)
  }
  for (let i = 0; i < thetaSegs; i++) {
    for (let j = 0; j < phiSegs; j++) {
      const a = rings[i][j], b = rings[i][j + 1], c = rings[i + 1][j], d = rings[i + 1][j + 1]
      idx.push(a, c, b, b, c, d)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

export default function Dome({ radius = 8 }) {
  const domeRef = useRef()
  const telescopeRA = useObservatoryStore((s) => s.telescopeRA)
  const scene       = useObservatoryStore((s) => s.scene)

  useEffect(() => {
    if (!domeRef.current || scene === 'start' || scene === 'entering') return
    const targetBase = (telescopeRA / 360) * Math.PI * 2
    const currentY = domeRef.current.rotation.y
    let diff = targetBase - currentY
    while (diff >  Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    gsap.to(domeRef.current.rotation, { y: currentY + diff, duration: 2, ease: 'power2.inOut' })
  }, [telescopeRA, scene])

  const slotHalf = 1.9                       // half-width of the slot (→ 3.8-unit slot)
  const railR = Math.sqrt(radius * radius - slotHalf * slotHalf) // edge-rail radius

  // Band runs from the apex (theta 0) down to the base. Near the apex the front
  // naturally opens (back stays closed), so the slot's top is an open crown — no
  // solid cap filling the semicircle at the top of the strip.
  const band = useMemo(() => makeSlottedBand(radius, slotHalf, 0, 44, 80), [radius])

  const matOuter = { color: '#1E3248', metalness: 0.7, roughness: 0.3 }
  const matInner = { color: '#0D1C2C', metalness: 0.3, roughness: 0.78 }

  return (
    <group rotation={[0, Math.PI, 0]}>
      <group ref={domeRef}>
        {/* ── Slotted shell band (base → rounded top) ── */}
        <mesh geometry={band} castShadow>
          <meshStandardMaterial {...matOuter} side={THREE.FrontSide} />
        </mesh>
        <mesh geometry={band}>
          <meshStandardMaterial {...matInner} side={THREE.BackSide} />
        </mesh>

        {/* ── Slot edge rails — straight parallel shutters at x = ±slotHalf ── */}
        {[slotHalf, -slotHalf].map((x, i) => (
          <mesh key={i} position={[x, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
            <torusGeometry args={[railR, 0.09, 8, 40, Math.PI / 2]} />
            <meshStandardMaterial color="#3A5A7A" metalness={0.88} roughness={0.16} />
          </mesh>
        ))}

        {/* Soft light spilling in through the slot */}
        <pointLight position={[0, radius * 0.5, radius * 0.5]} color="#4488BB" intensity={0.8} distance={7} decay={2} />

        {/* ── Base rim ring (rotates with the dome) ── */}
        <mesh position={[0, 0.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius - 0.06, 0.20, 10, 72]} />
          <meshStandardMaterial color="#2A4060" metalness={0.85} roughness={0.18} />
        </mesh>
      </group>
    </group>
  )
}
