/**
 * Telescope — Procedural telescope model built from Three.js primitives.
 * Animates to point at coordinates when targetRA/targetDec changes.
 * Mount shifted down an additional 0.3 from previous version.
 */
import React, { useRef, useEffect } from 'react'
import gsap from 'gsap'
import useObservatoryStore from '../../store/observatoryStore'

// White-painted observatory telescope with steel/chrome fittings.
const MAT = {
  bodyDark:   { color: '#8A909A', metalness: 0.4, roughness: 0.38 },
  bodyMid:    { color: '#AAB0BA', metalness: 0.4, roughness: 0.34 },
  bodyLight:  { color: '#C4C9D1', metalness: 0.4, roughness: 0.32 },
  chrome:     { color: '#9CB6CC', metalness: 0.95, roughness: 0.12 },
  darkChrome: { color: '#717986', metalness: 0.9,  roughness: 0.18 },
  accent:     { color: '#C0D8E8', metalness: 0.95, roughness: 0.08 },
  rubberGrip: { color: '#15191E', metalness: 0.0,  roughness: 0.95 },
  lensGlass:  { color: '#00AAFF', emissive: '#00AAFF', emissiveIntensity: 1.2, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.85 },
}
function M({ c }) { return <meshStandardMaterial {...c} /> }

function TubeRing({ y, r = 0.34 }) {
  return (
    <mesh position={[0, y, 0]}>
      <torusGeometry args={[r, 0.025, 8, 32]} />
      <meshStandardMaterial {...MAT.chrome} />
    </mesh>
  )
}


export default function Telescope() {
  const baseRef = useRef()
  const tubeRef = useRef()
  const telescopeRA  = useObservatoryStore((s) => s.telescopeRA)
  const telescopeDec = useObservatoryStore((s) => s.telescopeDec)
  const scene        = useObservatoryStore((s) => s.scene)

  useEffect(() => {
    if (!tubeRef.current || !baseRef.current || scene === 'start' || scene === 'entering') return
    const targetRotX = -(telescopeDec * Math.PI) / 180 * 0.8
    const targetBase = (telescopeRA / 360) * Math.PI * 2
    const currentY = baseRef.current.rotation.y
    let diff = targetBase - currentY
    while (diff >  Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    gsap.to(baseRef.current.rotation, { y: currentY + diff, duration: 2, ease: 'power2.inOut' })
    gsap.to(tubeRef.current.rotation, { x: targetRotX + Math.PI / 4, duration: 2, ease: 'power2.inOut' })
  }, [telescopeRA, telescopeDec, scene])

  return (
    <group position={[0, 0, 0]} scale={[2.5, 2.5, 2.5]} rotation={[0, Math.PI, 0]}>
      <group ref={baseRef}>

        {/* Pier column — shifted down 0.3 from previous: height 1.2, center 0.6 */}
        <mesh position={[0, 0.6, 0]}>
          <cylinderGeometry args={[0.45, 0.65, 1.2, 16]} />
          <M c={MAT.bodyDark} />
        </mesh>
        <mesh position={[0, 0.06, 0]}>
          <cylinderGeometry args={[0.75, 0.75, 0.12, 16]} />
          <M c={MAT.chrome} />
        </mesh>
        <mesh position={[0, 1.2, 0]}>
          <cylinderGeometry args={[0.55, 0.55, 0.10, 16]} />
          <M c={MAT.chrome} />
        </mesh>

        {/* Equatorial head — y 1.8→1.5 */}
        <mesh position={[0, 1.5, 0]}>
          <cylinderGeometry args={[0.35, 0.38, 0.55, 20]} />
          <M c={MAT.bodyMid} />
        </mesh>
        <mesh position={[0, 1.78, 0]}>
          <torusGeometry args={[0.37, 0.03, 8, 32]} />
          <M c={MAT.chrome} />
        </mesh>

        {/* Fork arms — y 2.4→2.1 */}
        <mesh position={[-0.42, 2.1, 0]}>
          <boxGeometry args={[0.16, 0.85, 0.22]} />
          <M c={MAT.bodyMid} />
        </mesh>
        <mesh position={[0.42, 2.1, 0]}>
          <boxGeometry args={[0.16, 0.85, 0.22]} />
          <M c={MAT.bodyMid} />
        </mesh>

        {/* Dec axis — y 2.85→2.55 */}
        <mesh position={[0, 2.55, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.10, 0.10, 1.0, 16]} />
          <M c={MAT.darkChrome} />
        </mesh>
        {[-0.5, 0.5].map((x, i) => (
          <mesh key={i} position={[x, 2.55, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.13, 0.13, 0.05, 16]} />
            <M c={MAT.chrome} />
          </mesh>
        ))}

        {/* Tube group — pivot y 2.85→2.55 */}
        <group ref={tubeRef} position={[0, 2.55, 0]} rotation={[Math.PI / 4, 0, 0]}>
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[0.29, 0.31, 5.0, 32]} />
            <M c={MAT.bodyMid} />
          </mesh>
          <TubeRing y={-2.1} /><TubeRing y={-0.9} /><TubeRing y={0.3} /><TubeRing y={1.5} /><TubeRing y={2.4} />

          {/* Front aperture */}
          <mesh position={[0, 2.56, 0]}>
            <torusGeometry args={[0.30, 0.04, 10, 32]} />
            <M c={MAT.chrome} />
          </mesh>
          <mesh position={[0, 2.85, 0]}>
            <cylinderGeometry args={[0.30, 0.30, 0.55, 32, 1, true]} />
            <M c={MAT.bodyDark} />
          </mesh>
          <mesh position={[0, 3.12, 0]}>
            <torusGeometry args={[0.30, 0.025, 8, 32]} />
            <M c={MAT.accent} />
          </mesh>
          <mesh position={[0, 2.58, 0]}>
            <circleGeometry args={[0.26, 48]} />
            <meshStandardMaterial {...MAT.lensGlass} />
          </mesh>
          <pointLight position={[0, 2.55, 0]} color="#00AAFF" intensity={0.8} distance={3} decay={3} />

          {/* Eyepiece end */}
          <mesh position={[0, -2.55, 0]}>
            <cylinderGeometry args={[0.22, 0.26, 0.42, 20]} />
            <M c={MAT.bodyLight} />
          </mesh>
          <mesh position={[0, -2.36, 0]}>
            <torusGeometry args={[0.235, 0.025, 8, 24]} />
            <M c={MAT.chrome} />
          </mesh>
          <mesh position={[0, -2.76, 0]}>
            <cylinderGeometry args={[0.16, 0.16, 0.36, 16]} />
            <M c={MAT.rubberGrip} />
          </mesh>
          {[-0.28, 0.28].map((x, i) => (
            <mesh key={i} position={[x, -2.56, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.075, 0.065, 0.12, 12]} />
              <M c={MAT.chrome} />
            </mesh>
          ))}
          <mesh position={[0, -3.05, 0]}>
            <cylinderGeometry args={[0.14, 0.16, 0.30, 16]} />
            <M c={MAT.darkChrome} />
          </mesh>

          {/* Finderscope */}
          <mesh position={[0.38, 0.4, 0]} rotation={[0, 0, 0.08]}>
            <cylinderGeometry args={[0.055, 0.065, 1.4, 12]} />
            <M c={MAT.bodyLight} />
          </mesh>
          <mesh position={[0.405, 1.12, 0]}>
            <torusGeometry args={[0.056, 0.018, 8, 16]} />
            <M c={MAT.chrome} />
          </mesh>
          {[-0.1, 0.9].map((y, i) => (
            <mesh key={i} position={[0.33, y, 0]}>
              <boxGeometry args={[0.14, 0.07, 0.14]} />
              <M c={MAT.darkChrome} />
            </mesh>
          ))}
        </group>



      </group>
    </group>
  )
}
