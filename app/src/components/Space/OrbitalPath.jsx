'use client'

/**
 * OrbitalPath — Renders Keplerian elliptical orbit paths as THREE.js Line objects.
 * Used to show planetary/asteroid orbits around a central star.
 */
import React, { useMemo } from 'react'
import * as THREE from 'three'
import { generateOrbitPoints } from '../../utils/astronomyMath'

export default function OrbitalPath({
  semiMajorAxis = 1,
  eccentricity = 0,
  inclination = 0,
  argOfPeriapsis = 0,
  longOfAscNode = 0,
  color = '#4FACFE',
  opacity = 0.35,
  scale = 1,   // Scene-space scale factor (AU → scene units)
}) {
  const points = useMemo(() => {
    const raw = generateOrbitPoints(
      semiMajorAxis * scale,
      eccentricity,
      inclination,
      argOfPeriapsis,
      longOfAscNode,
      128
    )
    return raw
  }, [semiMajorAxis, eccentricity, inclination, argOfPeriapsis, longOfAscNode, scale])

  const lineGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints(points)
    return geo
  }, [points])

  return (
    <line geometry={lineGeometry}>
      <lineBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </line>
  )
}
