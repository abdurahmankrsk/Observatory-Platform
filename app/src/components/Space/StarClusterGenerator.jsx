'use client'

/**
 * StarClusterGenerator — globular and open star clusters.
 *
 *   - globular: tens of thousands of old (yellow-red) stars in a dense,
 *     centrally-concentrated sphere.
 *   - open: a sparse, loose scattering of young (blue-white) stars.
 *
 * The backend lumps clusters into the "nebula" bucket; the classifier recovers
 * GlobularCluster / OpenCluster from the description ("globular cluster",
 * "open star cluster", "Seven Sisters", …) and routes them here.
 */
import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { temperatureToColor } from '../../utils/colorFromTemperature'

function gauss() {
  return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5
}

export default function StarClusterGenerator({ params, position = [0, 0, 0] }) {
  const groupRef = useRef()
  const isGlobular = (params?.clusterClass ?? 'open') === 'globular'
  const radius = params?.radius ?? 4
  const count = params?.starCount ?? (isGlobular ? 50000 : 1500)

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const base = temperatureToColor(params?.coreTempK ?? (isGlobular ? 4500 : 12000))

    for (let i = 0; i < count; i++) {
      let x, y, z
      if (isGlobular) {
        // Centrally concentrated sphere.
        x = gauss() * radius * 0.5
        y = gauss() * radius * 0.5
        z = gauss() * radius * 0.5
      } else {
        // Loose, slightly flattened scattering.
        x = (Math.random() - 0.5) * radius * 2
        y = (Math.random() - 0.5) * radius * 1.2
        z = (Math.random() - 0.5) * radius * 2
      }
      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z

      // Per-star colour jitter around the cluster's characteristic temperature.
      const c = base.clone()
      const jitter = 0.85 + Math.random() * 0.3
      c.r = Math.min(c.r * jitter, 1)
      c.g = Math.min(c.g * jitter, 1)
      c.b = Math.min(c.b * jitter, 1)
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return geo
  }, [count, radius, isGlobular, params])

  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = s.clock.elapsedTime * 0.01
  })

  return (
    <group ref={groupRef} position={position}>
      <points geometry={geometry}>
        <pointsMaterial
          size={isGlobular ? 0.05 : 0.12}
          sizeAttenuation
          vertexColors
          transparent
          opacity={0.95}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </group>
  )
}
