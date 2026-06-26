/**
 * Dome — Procedural observatory dome geometry.
 * A top half-sphere with a slit opening toward the top.
 */
import React, { useMemo, useEffect, useRef } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import useObservatoryStore from '../../store/observatoryStore'

export default function Dome({ radius = 8, openingAngle = 0.3 }) {
  const domeRef = useRef()
  const telescopeRA = useObservatoryStore((s) => s.telescopeRA)
  const scene = useObservatoryStore((s) => s.scene)

  // Rotate the dome to align the slit with the telescope's RA
  useEffect(() => {
    if (!domeRef.current || scene === 'start' || scene === 'entering') return
    const targetBase = (telescopeRA / 360) * Math.PI * 2
    
    // Calculate shortest path
    const currentY = domeRef.current.rotation.y
    let diff = targetBase - currentY
    while (diff > Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    
    gsap.to(domeRef.current.rotation, {
      y: currentY + diff, // Parent handles Math.PI offset to prevent React Fiber overrides
      duration: 2,
      ease: 'power2.inOut',
    })
  }, [telescopeRA, scene])

  // To create a perfect rectangular strip from bottom to top, we use two hemispheres spaced apart.
  // The left and right hemispheres need flat cuts along the YZ plane (so they bulge into X and -X).
  const gapWidth = 4.8 // An extremely wide strip opening
  const halfGap = gapWidth / 2

  // Right hemisphere (bulges into +X)
  const rightHemisphere = useMemo(() => new THREE.SphereGeometry(radius, 32, 32, Math.PI / 2, Math.PI, 0, Math.PI / 2), [radius])
  // Left hemisphere (bulges into -X)
  const leftHemisphere = useMemo(() => new THREE.SphereGeometry(radius, 32, 32, -Math.PI / 2, Math.PI, 0, Math.PI / 2), [radius])
  
  // Filler for the back of the dome to block the rear gap.
  // We use a Cylinder rotated along the X axis. This perfectly matches the spherical curve in the YZ plane,
  // but guarantees that the top edge of the slit is a perfectly straight horizontal line across the X axis.
  // thetaStart = Math.PI / 2 + 0.15 (starts slightly past the zenith towards the back)
  // thetaLength = Math.PI / 2 - 0.15 (stops exactly at the equator Y=0, preventing it from dipping into the room)
  const backFiller = useMemo(() => new THREE.CylinderGeometry(radius - 0.05, radius - 0.05, gapWidth, 32, 1, true, Math.PI / 2 + 0.15, Math.PI / 2 - 0.15), [radius, gapWidth])

  return (
    <group rotation={[0, Math.PI, 0]}>
      <group ref={domeRef}>
        {/* Right Half */}
        <mesh geometry={rightHemisphere} position={[halfGap, 0, 0]}>
          <meshStandardMaterial color="#1A2A3A" metalness={0.4} roughness={0.6} side={THREE.FrontSide} />
        </mesh>
        <mesh geometry={rightHemisphere} position={[halfGap, 0, 0]}>
          <meshStandardMaterial color="#0D1A26" metalness={0.2} roughness={0.8} side={THREE.BackSide} />
        </mesh>

        {/* Left Half */}
        <mesh geometry={leftHemisphere} position={[-halfGap, 0, 0]}>
          <meshStandardMaterial color="#1A2A3A" metalness={0.4} roughness={0.6} side={THREE.FrontSide} />
        </mesh>
        <mesh geometry={leftHemisphere} position={[-halfGap, 0, 0]}>
          <meshStandardMaterial color="#0D1A26" metalness={0.2} roughness={0.8} side={THREE.BackSide} />
        </mesh>

        {/* Back Filler */}
        <mesh geometry={backFiller} position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <meshStandardMaterial color="#1A2A3A" metalness={0.4} roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  )
}
