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
    // The descriptor carries the rocky RGB in `surfaceColor`; `color` is a hex
    // string used elsewhere, so prefer surfaceColor here.
    const c = params?.surfaceColor ?? { r: 0.45, g: 0.38, b: 0.3 }
    return new THREE.Color(c.r, c.g, c.b)
  }, [params?.surfaceColor])

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

  // Comet coma + tail particle field (streams away from an implied Sun at +X).
  const tailGeo = useMemo(() => {
    if (!params?.hasTail) return null
    const count = 4000
    const length = params?.tailLength ?? 8
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const t = Math.pow(Math.random(), 1.5)      // denser near the nucleus
      const spread = radius * (0.4 + t * 3.5)
      pos[i * 3] = -t * length                      // tail trails toward -X
      pos[i * 3 + 1] = (Math.random() - 0.5) * spread + t * length * 0.15
      pos[i * 3 + 2] = (Math.random() - 0.5) * spread
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return geo
  }, [params?.hasTail, params?.tailLength, radius])

  // Cleanup geometry on unmount
  useEffect(() => {
    return () => {
      geometry.dispose()
      if (tailGeo) tailGeo.dispose()
    }
  }, [geometry, tailGeo])

  return (
    <group position={position}>
      <mesh ref={meshRef} geometry={geometry}>
        <meshStandardMaterial
          color={color}
          roughness={params?.roughness ?? 0.9}
          metalness={params?.metalness ?? 0.1}
        />
      </mesh>

      {/* Comet coma + tail */}
      {params?.hasTail && (
        <>
          <mesh>
            <sphereGeometry args={[radius * 1.8, 24, 24]} />
            <meshBasicMaterial
              color={params?.tailColor ?? new THREE.Color(0.6, 0.8, 1.0)}
              transparent
              opacity={0.18}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          {tailGeo && (
            <points geometry={tailGeo}>
              <pointsMaterial
                color={params?.tailColor ?? new THREE.Color(0.6, 0.8, 1.0)}
                size={0.06}
                sizeAttenuation
                transparent
                opacity={0.5}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </points>
          )}
        </>
      )}

      {/* Dust halo (optional, faint point light for visual depth) */}
      <pointLight color="#AA9977" intensity={0.15} distance={radius * 8} />
    </group>
  )
}
