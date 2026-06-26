/**
 * Interior — The observatory interior room.
 * Cylindrical walls, circular floor, dome opening with starfield visible.
 * Atmospheric blue ambient lighting + spotlight on telescope.
 */
import React from 'react'
import * as THREE from 'three'
import { Stars } from '@react-three/drei'
import Telescope from './Telescope'
import Dome from './Dome'

export default function Interior() {
  return (
    <group>
      {/* Circular floor */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[7.8, 64]} />
        <meshStandardMaterial
          color="#1A2830"
          roughness={0.8}
          metalness={0.0}
        />
      </mesh>

      {/* Floor grid lines (faint blueprint aesthetic) */}
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[7.8, 64]} />
        <meshBasicMaterial
          color="#4FACFE"
          transparent
          opacity={0.04}
          wireframe={false}
        />
      </mesh>

      {/* Concentric floor rings */}
      {[2, 4, 6].map((r, i) => (
        <mesh key={i} position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[r - 0.03, r, 64]} />
          <meshBasicMaterial color="#4FACFE" transparent opacity={0.06} />
        </mesh>
      ))}

      {/* Cylindrical walls */}
      <mesh position={[0, 4, 0]}>
        <cylinderGeometry args={[8, 8, 8, 64, 1, true]} />
        <meshStandardMaterial
          color="#1D2E3E"
          roughness={0.8}
          metalness={0.0}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Wall panel details — vertical pilasters */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * Math.PI * 2
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * 7.7, 4, Math.sin(angle) * 7.7]}
            rotation={[0, -angle, 0]}
          >
            <boxGeometry args={[0.15, 8, 0.2]} />
            <meshStandardMaterial color="#162535" metalness={0.5} roughness={0.5} />
          </mesh>
        )
      })}

      {/* Dome */}
      <group position={[0, 8, 0]}>
        <Dome radius={8} />
      </group>

      {/* Stars visible through dome opening */}
      <Stars
        radius={100}
        depth={50}
        count={3000}
        factor={3}
        saturation={0.05}
        fade
      />

      {/* Telescope — center of the room */}
      <Telescope />

      {/* Control console — behind telescope */}
      <group position={[0, 0, -3]}>
        {/* Console body */}
        <mesh position={[0, 0.8, 0]}>
          <boxGeometry args={[2.5, 1.6, 0.6]} />
          <meshStandardMaterial color="#0F2030" metalness={0.6} roughness={0.4} />
        </mesh>
        {/* Screen glow */}
        <mesh position={[0, 1.2, 0.31]}>
          <planeGeometry args={[2.0, 0.9]} />
          <meshBasicMaterial color="#4FACFE" transparent opacity={0.08} />
        </mesh>
        {/* Control buttons row */}
        {[-0.6, -0.2, 0.2, 0.6].map((x, i) => (
          <mesh key={i} position={[x, 0.6, 0.31]}>
            <circleGeometry args={[0.07, 8]} />
            <meshBasicMaterial color={i === 0 ? '#FF6B35' : '#4FACFE'} transparent opacity={0.8} />
          </mesh>
        ))}
      </group>

      {/* Bench seating */}
      <mesh position={[0, 0.3, 5]} rotation={[0, 0, 0]}>
        <boxGeometry args={[3, 0.6, 0.6]} />
        <meshStandardMaterial color="#0D1820" roughness={0.8} />
      </mesh>

      {/* Lighting ──────────────────────────────────────────────── */}
      {/* Base ambient lighting */}
      <ambientLight color="#ffffff" intensity={2.0} />

      {/* Large area light to simulate bouncing light */}
      <pointLight position={[0, 5, 0]} color="#ffffff" intensity={4} distance={15} decay={2} />

      {/* Spotlight directly down on telescope */}
      <spotLight
        position={[0, 7, 0]}
        target-position={[0, 0, 0]}
        angle={1.0}
        penumbra={0.5}
        intensity={8}
        color="#ffffff"
        castShadow={false}
      />

      {/* Warm accent from console */}
      <pointLight position={[0, 1.5, -3]} color="#FFB347" intensity={2.0} distance={6} decay={2} />

      {/* Visible wall lights */}
      {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((angle, i) => (
        <group key={`light-${i}`} position={[Math.cos(angle) * 7.5, 4.5, Math.sin(angle) * 7.5]} rotation={[0, -angle, 0]}>
          <mesh>
            <boxGeometry args={[0.5, 0.1, 0.1]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <pointLight color="#ffffff" intensity={1.5} distance={10} decay={2} />
        </group>
      ))}

      {/* Exterior Mountain / Hill */}
      <mesh position={[0, -120, 0]}>
        <sphereGeometry args={[120, 64, 64, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#0A0C10" roughness={1.0} metalness={0.0} />
      </mesh>
    </group>
  )
}
