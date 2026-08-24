'use client'

/**
 * QuasarGenerator — an active galactic nucleus: a supermassive black hole engine
 * (reusing BlackHoleGenerator for the accretion disk + relativistic jets), a
 * blazing additive nucleus, and a faint surrounding host-galaxy star cloud.
 *
 * Quasars outshine their entire host galaxy, so the nucleus glow and disk
 * brightness are pushed well above an ordinary black hole's.
 */
import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import BlackHoleGenerator from './BlackHoleGenerator'

export default function QuasarGenerator({ params, position = [0, 0, 0] }) {
  const nucleusRef = useRef()
  const hostRef = useRef()
  const r = params?.radius ?? 0.8

  // Faint host-galaxy disk of stars surrounding the AGN.
  const hostGeo = useMemo(() => {
    if (!params?.hostGlow) return null
    const count = 5000
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(count * 3)
    const radius = (params?.diskOuter ?? 5) * 2.4
    for (let i = 0; i < count; i++) {
      const rr = Math.pow(Math.random(), 0.6) * radius
      const a = Math.random() * Math.PI * 2
      pos[i * 3] = Math.cos(a) * rr + (Math.random() - 0.5) * 0.6
      pos[i * 3 + 1] = (Math.random() - 0.5) * radius * 0.12 * (1 - rr / radius)
      pos[i * 3 + 2] = Math.sin(a) * rr + (Math.random() - 0.5) * 0.6
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return geo
  }, [params])

  useFrame((s) => {
    const t = s.clock.elapsedTime
    if (hostRef.current) hostRef.current.rotation.y = t * 0.02
    if (nucleusRef.current) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 1.5)
      nucleusRef.current.scale.setScalar(1 + 0.05 * pulse)
      nucleusRef.current.material.opacity = 0.22 + 0.12 * pulse
    }
  })

  return (
    <group position={position}>
      {/* Host galaxy */}
      {hostGeo && (
        <points ref={hostRef} geometry={hostGeo} rotation={[params?.diskTilt ?? 0.5, 0, 0]}>
          <pointsMaterial
            color={params?.hostColor ?? new THREE.Color(0.5, 0.55, 0.8)}
            size={0.075}
            sizeAttenuation
            transparent
            opacity={0.5}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </points>
      )}

      {/* Central engine: accretion disk + jets (black hole core) */}
      <BlackHoleGenerator params={params} />

      {/* Blazing nucleus glow */}
      <mesh ref={nucleusRef}>
        <sphereGeometry args={[r * 0.9, 32, 32]} />
        <meshBasicMaterial
          color={params?.diskInnerColor ?? new THREE.Color(0.85, 0.92, 1.0)}
          transparent
          opacity={0.28}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <pointLight
        color={params?.jetColor ?? new THREE.Color(0.7, 0.85, 1.0)}
        intensity={params?.glowIntensity ?? 3}
        distance={r * 60}
        decay={2}
      />
    </group>
  )
}
