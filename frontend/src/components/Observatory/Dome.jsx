/**
 * Dome — Procedural observatory dome geometry.
 * A top half-sphere with a slit opening toward the top.
 */
import React, { useMemo } from 'react'
import * as THREE from 'three'

export default function Dome({ radius = 8, openingAngle = 0.3 }) {
  // Build the dome as a custom half-sphere with an opening gap
  const geometry = useMemo(() => {
    const geo = new THREE.SphereGeometry(radius, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2)
    return geo
  }, [radius])

  return (
    <group>
      {/* Outer dome shell */}
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color="#1A2A3A"
          metalness={0.4}
          roughness={0.6}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Inner dome surface */}
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color="#0D1A26"
          metalness={0.2}
          roughness={0.8}
          side={THREE.FrontSide}
        />
      </mesh>

      {/* Dome slit / opening toward stars — a bright strip */}
      <mesh position={[0, radius * 0.4, 0]} rotation={[0, 0, 0]}>
        <boxGeometry args={[2.5, radius * 0.8, 0.1]} />
        <meshBasicMaterial color="#020B18" transparent opacity={0} />
      </mesh>

      {/* Structural rib rings around dome */}
      {[0.2, 0.5, 0.75].map((t, i) => {
        const y = Math.sin(t * Math.PI / 2) * radius
        const r = Math.cos(t * Math.PI / 2) * radius
        return (
          <mesh key={i} position={[0, y, 0]}>
            <torusGeometry args={[r, 0.06, 8, 64]} />
            <meshStandardMaterial color="#2A3A4A" metalness={0.7} roughness={0.3} />
          </mesh>
        )
      })}
    </group>
  )
}
