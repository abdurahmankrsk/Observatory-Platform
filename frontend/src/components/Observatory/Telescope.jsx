/**
 * Telescope — Procedural telescope model built from lathe geometry.
 * Animates to point at coordinates when targetRA/targetDec changes.
 */
import React, { useRef, useEffect, useMemo } from 'react'
import gsap from 'gsap'
import * as THREE from 'three'
import useObservatoryStore from '../../store/observatoryStore'

function TelescopeTube({ length, radiusTop, radiusBot }) {
  return (
    <mesh>
      <cylinderGeometry args={[radiusTop, radiusBot, length, 32]} />
      <meshStandardMaterial color="#1C2F40" metalness={0.1} roughness={0.8} />
    </mesh>
  )
}

export default function Telescope() {
  const baseRef = useRef()
  const mountRef = useRef()
  const tubeRef = useRef()

  const telescopeRA = useObservatoryStore((s) => s.telescopeRA)
  const telescopeDec = useObservatoryStore((s) => s.telescopeDec)
  const scene = useObservatoryStore((s) => s.scene)

  // Animate telescope rotation when target changes
  useEffect(() => {
    if (!tubeRef.current || !baseRef.current || scene === 'start' || scene === 'entering') return

    const targetRotX = -(telescopeDec * Math.PI) / 180 * 0.8
    const targetBase = (telescopeRA / 360) * Math.PI * 2
    
    // Calculate shortest path for base rotation
    const currentY = baseRef.current.rotation.y
    let diff = targetBase - currentY
    while (diff > Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2

    // Rotate the inner base for RA so it matches the dome
    gsap.to(baseRef.current.rotation, {
      y: currentY + diff, // Parent handles Math.PI offset to prevent React Fiber overrides
      duration: 2,
      ease: 'power2.inOut',
    })

    // Tilt only the tube for Dec
    gsap.to(tubeRef.current.rotation, {
      x: targetRotX + Math.PI / 4, // base tilt + pointing
      duration: 2,
      ease: 'power2.inOut',
    })
  }, [telescopeRA, telescopeDec, scene])

  // Removed idle slow scan animation per user request so the telescope stays pointed at the hole

  return (
    <group position={[0, 0, 0]} scale={[2.5, 2.5, 2.5]} rotation={[0, Math.PI, 0]}>
      <group ref={baseRef}>
      {/* Base mount — heavy cylinder raised to prevent clipping floor */}
      <mesh position={[0, 1.25, 0]}>
        <cylinderGeometry args={[0.6, 0.8, 2.5, 16]} />
        <meshStandardMaterial color="#162230" metalness={0.1} roughness={0.8} />
      </mesh>

      {/* Equatorial mount ring */}
      <mesh ref={mountRef} position={[0, 2.5, 0]}>
        <torusGeometry args={[0.5, 0.12, 8, 32]} />
        <meshStandardMaterial color="#243548" metalness={0.1} roughness={0.8} />
      </mesh>

      {/* Telescope tube group — rotates toward sky target */}
      <group ref={tubeRef} position={[0, 2.5, 0]} rotation={[Math.PI / 4, 0, 0]}>
        {/* Main tube */}
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.28, 0.32, 4.8, 24]} />
          <meshStandardMaterial color="#1A2E40" metalness={0.1} roughness={0.8} />
        </mesh>

        {/* Focuser at bottom */}
        <mesh position={[0, -2.5, 0]}>
          <cylinderGeometry args={[0.2, 0.28, 0.4, 16]} />
          <meshStandardMaterial color="#243548" metalness={0.1} roughness={0.8} />
        </mesh>

        {/* Lens cap at top */}
        <mesh position={[0, 2.45, 0]}>
          <cylinderGeometry args={[0.29, 0.29, 0.1, 24]} />
          <meshStandardMaterial color="#0A1520" metalness={0.1} roughness={0.8} />
        </mesh>

        {/* Finderscope */}
        <mesh position={[0.35, 0.3, 0]} rotation={[0, 0, 0.1]}>
          <cylinderGeometry args={[0.06, 0.07, 1.2, 12]} />
          <meshStandardMaterial color="#243548" metalness={0.1} roughness={0.8} />
        </mesh>

        {/* Lens glow — tiny emissive blue dot inside tube */}
        <mesh position={[0, 2.4, 0]}>
          <circleGeometry args={[0.2, 32]} />
          <meshBasicMaterial color="#4FACFE" transparent opacity={0.3} />
        </mesh>
      </group>

      {/* Counterweight bar */}
      <mesh position={[-0.45, 2.3, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 0.9, 8]} />
        <meshStandardMaterial color="#1A2A3A" metalness={0.1} roughness={0.8} />
      </mesh>

      {/* Counterweight */}
      <mesh position={[-0.9, 2.3, 0]}>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshStandardMaterial color="#243040" metalness={0.1} roughness={0.8} />
      </mesh>
      </group>
    </group>
  )
}
