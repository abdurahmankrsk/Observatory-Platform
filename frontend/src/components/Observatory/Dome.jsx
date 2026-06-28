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

// Horizontal latitude band that covers only the CLOSED arc — the gap is baked
// to the front (+Z) so the band never crosses the slit.
function makeLatRing(ringR, tube, phiW) {
  const arc = Math.PI * 2 - 2 * phiW
  const g = new THREE.TorusGeometry(ringR, tube, 6, 84, arc)
  g.rotateZ(Math.PI / 2 + phiW)   // centre the gap on the front meridian
  g.rotateX(Math.PI / 2)          // lay flat
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

  // White-painted-metal dome (matte), like real observatories.
  const matOuter = { color: '#C6CBD3', metalness: 0.18, roughness: 0.52 }
  const matInner = { color: '#9098A2', metalness: 0.12, roughness: 0.7 }

  // ── Structural detail (all inside domeRef so it tracks the dome; all kept off
  //    the front slit so it never blocks the telescope) ──
  const ribAngles = [60, 100, 140, 180, 220, 260, 300].map((d) => (d * Math.PI) / 180)
  const ribOut = useMemo(() => new THREE.TorusGeometry(radius + 0.05, 0.06, 6, 40, 1.1), [radius])
  const ribIn  = useMemo(() => new THREE.TorusGeometry(radius - 0.12, 0.05, 6, 40, 1.1), [radius])

  // Latitude bands (gap baked to the front so they skip the slit)
  const bands = useMemo(() =>
    [0.26, 0.5, 0.72].map((t) => {
      const theta = (1 - t) * Math.PI / 2
      const ringR = radius * Math.sin(theta)
      const phiW = Math.asin(Math.min(0.96, slotHalf / ringR)) + 0.1
      return { geo: makeLatRing(ringR, 0.055, phiW), y: radius * Math.cos(theta) }
    }), [radius])

  // Bolts/rivets around the base (skipping the doorway-side slit)
  const bolts = useMemo(() => {
    const mesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.085, 8, 6),
      new THREE.MeshStandardMaterial({ color: '#8AAFCC', metalness: 0.9, roughness: 0.2 }), 32)
    const d = new THREE.Object3D()
    let n = 0
    for (let deg = 40; deg <= 320; deg += 18) {
      const a = (deg * Math.PI) / 180
      const rr = radius - 0.04
      d.position.set(rr * Math.sin(a), 0.18, rr * Math.cos(a))
      d.updateMatrix()
      mesh.setMatrixAt(n++, d.matrix)
    }
    mesh.count = n
    mesh.instanceMatrix.needsUpdate = true
    return mesh
  }, [radius])

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
            <meshStandardMaterial color="#6E7682" metalness={0.85} roughness={0.22} />
          </mesh>
        ))}

        {/* Soft light spilling in through the slot */}
        <pointLight position={[0, radius * 0.5, radius * 0.5]} color="#4488BB" intensity={0.8} distance={7} decay={2} />

        {/* ── Vertical structural ribs (outer + inner), off the slit ── */}
        {ribAngles.map((a, i) => (
          <group key={`rib-${i}`}>
            <mesh geometry={ribOut} rotation={[0, -Math.PI / 2 + a, 0]}>
              <meshStandardMaterial color="#B4BAC4" metalness={0.2} roughness={0.5} />
            </mesh>
            <mesh geometry={ribIn} rotation={[0, -Math.PI / 2 + a, 0]}>
              <meshStandardMaterial color="#8E96A0" metalness={0.15} roughness={0.6} />
            </mesh>
          </group>
        ))}

        {/* ── Latitude bands (gapped at the front so they skip the slit) ── */}
        {bands.map((b, i) => (
          <mesh key={`band-${i}`} geometry={b.geo} position={[0, b.y, 0]}>
            <meshStandardMaterial color="#AEB4BE" metalness={0.2} roughness={0.45} />
          </mesh>
        ))}

        {/* ── Rivets around the base ── */}
        <primitive object={bolts} />

        {/* ── Base rim ring (rotates with the dome) ── */}
        <mesh position={[0, 0.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius - 0.06, 0.20, 10, 72]} />
          <meshStandardMaterial color="#AAB0BA" metalness={0.2} roughness={0.45} />
        </mesh>
      </group>
    </group>
  )
}
