/**
 * BinaryStarGenerator — multiple-star systems (binary, triple, quadruple…).
 *
 * Renders each component as a full procedural Star, placed on a shared orbit
 * around the system barycentre and revolved over time. Heavier (larger) stars
 * sit on tighter orbits, so a bright primary with a small companion (e.g. Sirius
 * A + the white-dwarf Sirius B) reads correctly.
 */
import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import Star from './Star'

export default function BinaryStarGenerator({ params, position = [0, 0, 0] }) {
  const orbitRef = useRef()
  const stars = params?.stars ?? []
  const separation = params?.separation ?? 4

  // Place each component on a circle; orbit radius is inversely proportional to
  // its size (mass proxy) so the primary orbits nearer the barycentre.
  const placements = useMemo(() => {
    const n = stars.length || 1
    const totalR = stars.reduce((sum, s) => sum + (s.radius || 1), 0) || 1
    return stars.map((s, i) => {
      const angle = (i / n) * Math.PI * 2
      // Fraction of the opposite components' mass → this body's orbit radius.
      const orbitR = n === 1 ? 0 : (separation / 2) * (1 - (s.radius || 1) / totalR) * 2
      return [Math.cos(angle) * orbitR, 0, Math.sin(angle) * orbitR]
    })
  }, [stars, separation])

  useFrame((state) => {
    if (orbitRef.current) orbitRef.current.rotation.y = state.clock.elapsedTime * (params?.orbitSpeed ?? 0.2)
  })

  return (
    <group position={position}>
      <group ref={orbitRef}>
        {stars.map((s, i) => (
          <Star key={i} params={s} position={placements[i]} />
        ))}
      </group>
    </group>
  )
}
