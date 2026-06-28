/**
 * UnknownObject — fallback for objects the classifier cannot place.
 *
 * Renders a neutral grey wireframe sphere with a floating "?" marker and an
 * honest message rather than fabricating a misleading appearance. The full
 * metadata still appears in the InfoPanel; this just signals "we don't have
 * enough information to depict this accurately."
 */
import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

export default function UnknownObject({ params, position = [0, 0, 0] }) {
  const meshRef = useRef()
  const r = params?.radius ?? 1.2

  useFrame((s) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = s.clock.elapsedTime * 0.15
      meshRef.current.rotation.x = s.clock.elapsedTime * 0.05
    }
  })

  return (
    <group position={position}>
      {/* Solid neutral core */}
      <mesh>
        <sphereGeometry args={[r, 32, 32]} />
        <meshStandardMaterial color="#3a4150" roughness={0.9} metalness={0.1} />
      </mesh>
      {/* Wireframe shell — reads as "schematic / unknown" */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[r * 1.04, 24, 16]} />
        <meshBasicMaterial color="#8892a0" wireframe transparent opacity={0.4} />
      </mesh>

      <Html center distanceFactor={r * 8} style={{ pointerEvents: 'none' }}>
        <div style={{ textAlign: 'center', userSelect: 'none' }}>
          <div style={{ fontSize: 48, fontWeight: 700, color: '#aeb6c2', lineHeight: 1 }}>?</div>
          <div style={{
            marginTop: 6, fontSize: 11, letterSpacing: '0.05em',
            color: '#8892a0', maxWidth: 180, fontFamily: 'monospace',
          }}>
            {params?.message ?? 'No accurate visualization available.'}
          </div>
        </div>
      </Html>

      <ambientLight intensity={0.4} />
      <pointLight position={[5, 5, 5]} intensity={0.6} color={new THREE.Color(0.7, 0.75, 0.85)} />
    </group>
  )
}
