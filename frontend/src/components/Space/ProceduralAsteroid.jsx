/**
 * ProceduralAsteroid — IcosahedronGeometry with simplex noise displacement.
 * Creates irregular, rocky asteroids with tumbling rotation.
 */
import React, { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createNoise3D } from 'simplex-noise'

export default function ProceduralAsteroid({ params, position = [0, 0, 0] }) {
  const meshRef = useRef()
  const noise3D = useMemo(() => createNoise3D(), [])

  const radius = params?.radius ?? 0.5
  const detail = params?.detail ?? 4
  const noiseStrength = params?.noiseStrength ?? 0.25
  const noiseScale = params?.noiseScale ?? 0.8

  // Build displaced geometry
  const geometry = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(radius, detail)
    const positions = geo.attributes.position

    // Displace each vertex with 3D noise
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i)
      const y = positions.getY(i)
      const z = positions.getZ(i)

      const nx = x / radius
      const ny = y / radius
      const nz = z / radius

      // Multi-octave noise for natural irregularity
      let displacement = 0
      displacement += noise3D(nx * noiseScale, ny * noiseScale, nz * noiseScale) * 1.0
      displacement += noise3D(nx * noiseScale * 2, ny * noiseScale * 2, nz * noiseScale * 2) * 0.5
      displacement += noise3D(nx * noiseScale * 4, ny * noiseScale * 4, nz * noiseScale * 4) * 0.25

      const scale = 1 + displacement * noiseStrength
      positions.setXYZ(i, x * scale, y * scale, z * scale)
    }

    geo.computeVertexNormals()
    return geo
  }, [radius, detail, noiseStrength, noiseScale])

  const color = useMemo(() => {
    const c = params?.color ?? { r: 0.45, g: 0.38, b: 0.3 }
    return new THREE.Color(c.r, c.g, c.b)
  }, [params?.color])

  // Tumbling rotation axes
  const rotSpeed = useMemo(() => ({
    x: params?.rotationX ?? 0.02,
    y: params?.rotationY ?? 0.15,
    z: params?.rotationZ ?? 0.01,
  }), [params])

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += rotSpeed.x * delta
      meshRef.current.rotation.y += rotSpeed.y * delta
      meshRef.current.rotation.z += rotSpeed.z * delta
    }
  })

  // Cleanup geometry on unmount
  useEffect(() => {
    return () => {
      geometry.dispose()
    }
  }, [geometry])

  return (
    <group position={position}>
      <mesh ref={meshRef} geometry={geometry}>
        <meshStandardMaterial
          color={color}
          roughness={params?.roughness ?? 0.9}
          metalness={params?.metalness ?? 0.1}
        />
      </mesh>

      {/* Dust halo (optional, faint point light for visual depth) */}
      <pointLight color="#AA9977" intensity={0.15} distance={radius * 8} />
    </group>
  )
}
