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
      <meshStandardMaterial color="#1C2F40" metalness={0.6} roughness={0.3} />
    </mesh>
  )
}

export default function Telescope() {
  const mountRef = useRef()
  const tubeRef = useRef()

  const telescopeRA = useObservatoryStore((s) => s.telescopeRA)
  const telescopeDec = useObservatoryStore((s) => s.telescopeDec)
  const scene = useObservatoryStore((s) => s.scene)

  // Animate telescope rotation when target changes
  useEffect(() => {
    if (!tubeRef.current || scene === 'start' || scene === 'entering') return

    const targetRotX = -(telescopeDec * Math.PI) / 180 * 0.8
    const targetRotY = (telescopeRA / 360) * Math.PI * 2

    gsap.to(tubeRef.current.rotation, {
      x: targetRotX + Math.PI / 4, // base tilt + pointing
      y: targetRotY,
      duration: 2,
      ease: 'power2.inOut',
    })
  }, [telescopeRA, telescopeDec, scene])

  // Idle slow scan animation when in observatory
  useEffect(() => {
    if (!tubeRef.current || scene !== 'observatory') return
    const idleTween = gsap.to(tubeRef.current.rotation, {
      y: '+=0.8',
      duration: 8,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    })
    return () => idleTween.kill()
  }, [scene])

  return (
    <group position={[0, 0, 0]}>
      {/* Base mount — heavy cylinder */}
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.6, 0.8, 0.8, 16]} />
        <meshStandardMaterial color="#162230" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Equatorial mount ring */}
      <mesh ref={mountRef} position={[0, 1.0, 0]}>
        <torusGeometry args={[0.5, 0.12, 8, 32]} />
        <meshStandardMaterial color="#243548" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Telescope tube group — rotates toward sky target */}
      <group ref={tubeRef} position={[0, 1.0, 0]} rotation={[Math.PI / 4, 0, 0]}>
        {/* Main tube */}
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.28, 0.32, 3.2, 24]} />
          <meshStandardMaterial color="#1A2E40" metalness={0.55} roughness={0.4} />
        </mesh>

        {/* Focuser at bottom */}
        <mesh position={[0, -1.7, 0]}>
          <cylinderGeometry args={[0.2, 0.28, 0.4, 16]} />
          <meshStandardMaterial color="#243548" metalness={0.7} roughness={0.3} />
        </mesh>

        {/* Lens cap at top */}
        <mesh position={[0, 1.7, 0]}>
          <cylinderGeometry args={[0.29, 0.29, 0.1, 24]} />
          <meshStandardMaterial color="#0A1520" metalness={0.5} roughness={0.5} />
        </mesh>

        {/* Finderscope */}
        <mesh position={[0.35, 0.3, 0]} rotation={[0, 0, 0.1]}>
          <cylinderGeometry args={[0.06, 0.07, 1.2, 12]} />
          <meshStandardMaterial color="#243548" metalness={0.6} roughness={0.4} />
        </mesh>

        {/* Lens glow — tiny emissive blue dot inside tube */}
        <mesh position={[0, 1.65, 0]}>
          <circleGeometry args={[0.2, 32]} />
          <meshBasicMaterial color="#4FACFE" transparent opacity={0.3} />
        </mesh>
      </group>

      {/* Counterweight bar */}
      <mesh position={[-0.45, 0.8, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 0.9, 8]} />
        <meshStandardMaterial color="#1A2A3A" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Counterweight */}
      <mesh position={[-0.9, 0.8, 0]}>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshStandardMaterial color="#243040" metalness={0.9} roughness={0.1} />
      </mesh>
    </group>
  )
}
