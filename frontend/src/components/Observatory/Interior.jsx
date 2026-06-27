/**
 * Interior — The observatory interior room.
 * Upgraded: textured floor, detailed wall panels, equipment shelves,
 * improved console, red-lit atmospheric night lighting.
 */
import React, { useRef, useEffect } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import { Stars } from '@react-three/drei'
import Telescope from './Telescope'
import Dome from './Dome'
import useObservatoryStore from '../../store/observatoryStore'

// Half-angle of the door gap in the cylinder wall (rad)
// At radius=8, gap half-width = 8*sin(GAP_ANGLE) ≈ 1.30 units
const GAP_ANGLE = 0.163
const DOOR_Z    = 7.88   // front face of wall (slightly inside radius=8)
const DOOR_HALF = 1.28   // half-width of the door opening
const DOOR_H    = 3.8    // door height

/**
 * Door — Double hinged doors at the front (z=+8 face).
 * Swings inward on 'entering' scene signal.
 */
function Door() {
  const leftRef  = useRef()
  const rightRef = useRef()
  const scene    = useObservatoryStore((s) => s.scene)

  useEffect(() => {
    if (scene !== 'entering') return
    // Doors swing inward: left rotates +90° around Y, right -90°
    // Start opening 0.5s in so they're mostly open before the camera arrives
    gsap.to(leftRef.current.rotation,  { y:  Math.PI / 2, duration: 0.8, delay: 0.5, ease: 'power2.inOut' })
    gsap.to(rightRef.current.rotation, { y: -Math.PI / 2, duration: 0.8, delay: 0.5, ease: 'power2.inOut' })
  }, [scene])

  const postH = DOOR_H + 0.5

  return (
    <group>
      {/* ─ Left door frame post */}
      <mesh position={[-DOOR_HALF - 0.14, postH / 2, DOOR_Z]}>
        <boxGeometry args={[0.26, postH, 0.30]} />
        <meshStandardMaterial color="#162535" metalness={0.65} roughness={0.38} />
      </mesh>
      {/* ─ Right door frame post */}
      <mesh position={[DOOR_HALF + 0.14, postH / 2, DOOR_Z]}>
        <boxGeometry args={[0.26, postH, 0.30]} />
        <meshStandardMaterial color="#162535" metalness={0.65} roughness={0.38} />
      </mesh>
      {/* ─ Lintel */}
      <mesh position={[0, DOOR_H + 0.15, DOOR_Z]}>
        <boxGeometry args={[DOOR_HALF * 2 + 0.52, 0.30, 0.30]} />
        <meshStandardMaterial color="#162535" metalness={0.65} roughness={0.38} />
      </mesh>
      {/* ─ Threshold step */}
      <mesh position={[0, 0.04, DOOR_Z]}>
        <boxGeometry args={[DOOR_HALF * 2, 0.08, 0.35]} />
        <meshStandardMaterial color="#243040" metalness={0.80} roughness={0.20} />
      </mesh>

      {/* ─ Left panel — pivot at x=-DOOR_HALF, swings inward */}
      <group ref={leftRef} position={[-DOOR_HALF, DOOR_H / 2, DOOR_Z]}>
        {/* Panel body — extends past center, clearly in front of right panel (z+0.07) */}
        <mesh position={[DOOR_HALF / 2 + 0.06, 0, 0.07]}>
          <boxGeometry args={[DOOR_HALF + 0.12, DOOR_H, 0.10]} />
          <meshStandardMaterial color="#0D1C2C" metalness={0.55} roughness={0.48} />
        </mesh>
        {/* Upper window pane */}
        <mesh position={[DOOR_HALF / 2, DOOR_H * 0.18, 0.062]}>
          <planeGeometry args={[DOOR_HALF * 0.62, DOOR_H * 0.36]} />
          <meshBasicMaterial color="#4FACFE" transparent opacity={0.14} />
        </mesh>
        {/* Handle */}
        <mesh position={[DOOR_HALF * 0.84, 0, 0.08]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.035, 0.20, 10]} />
          <meshStandardMaterial color="#8AAFCC" metalness={0.95} roughness={0.08} />
        </mesh>
        {/* Raised panel inset */}
        <mesh position={[DOOR_HALF / 2, -DOOR_H * 0.20, 0.058]}>
          <boxGeometry args={[DOOR_HALF * 0.72, DOOR_H * 0.30, 0.03]} />
          <meshStandardMaterial color="#0A1828" metalness={0.4} roughness={0.6} />
        </mesh>
      </group>

      {/* ─ Right panel — pivot at x=+DOOR_HALF, swings inward */}
      <group ref={rightRef} position={[DOOR_HALF, DOOR_H / 2, DOOR_Z]}>
        {/* Panel body — extends 0.12 past center to hide the seam */}
        <mesh position={[-DOOR_HALF / 2 - 0.06, 0, 0]}>
          <boxGeometry args={[DOOR_HALF + 0.12, DOOR_H, 0.10]} />
          <meshStandardMaterial color="#0D1C2C" metalness={0.55} roughness={0.48} />
        </mesh>
        {/* Upper window pane */}
        <mesh position={[-DOOR_HALF / 2, DOOR_H * 0.18, 0.062]}>
          <planeGeometry args={[DOOR_HALF * 0.62, DOOR_H * 0.36]} />
          <meshBasicMaterial color="#4FACFE" transparent opacity={0.14} />
        </mesh>
        {/* Handle */}
        <mesh position={[-DOOR_HALF * 0.84, 0, 0.08]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.035, 0.20, 10]} />
          <meshStandardMaterial color="#8AAFCC" metalness={0.95} roughness={0.08} />
        </mesh>
        {/* Raised panel inset */}
        <mesh position={[-DOOR_HALF / 2, -DOOR_H * 0.20, 0.058]}>
          <boxGeometry args={[DOOR_HALF * 0.72, DOOR_H * 0.30, 0.03]} />
          <meshStandardMaterial color="#0A1828" metalness={0.4} roughness={0.6} />
        </mesh>
      </group>
    </group>
  )
}

/** Small glowing instrument indicator dot */
function IndicatorLight({ position, color, intensity = 0.6 }) {
  return (
    <mesh position={position}>
      <circleGeometry args={[0.06, 8]} />
      <meshBasicMaterial color={color} />
      <pointLight color={color} intensity={intensity} distance={1.5} decay={3} />
    </mesh>
  )
}

/** Wall shelf unit */
function ShelfUnit({ position, rotation = [0, 0, 0] }) {
  return (
    <group position={position} rotation={rotation}>
      {/* Back plate */}
      <mesh position={[0, 0, -0.05]}>
        <boxGeometry args={[1.4, 1.2, 0.06]} />
        <meshStandardMaterial color="#0D1820" metalness={0.4} roughness={0.6} />
      </mesh>
      {/* Shelves */}
      {[-0.3, 0.1, 0.45].map((y, i) => (
        <mesh key={i} position={[0, y, 0]}>
          <boxGeometry args={[1.35, 0.05, 0.28]} />
          <meshStandardMaterial color="#162535" metalness={0.5} roughness={0.5} />
        </mesh>
      ))}
      {/* Instruments on shelves — small emissive boxes */}
      <mesh position={[-0.4, 0.18, 0.05]}>
        <boxGeometry args={[0.28, 0.18, 0.18]} />
        <meshStandardMaterial color="#0F2030" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[-0.38, 0.28, 0.065]}>
        <planeGeometry args={[0.22, 0.12]} />
        <meshBasicMaterial color="#00FF88" transparent opacity={0.55} />
      </mesh>
      <mesh position={[0.25, 0.18, 0.06]}>
        <boxGeometry args={[0.22, 0.18, 0.16]} />
        <meshStandardMaterial color="#0F2030" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0.24, 0.28, 0.071]}>
        <planeGeometry args={[0.16, 0.09]} />
        <meshBasicMaterial color="#FF4488" transparent opacity={0.55} />
      </mesh>
      {/* Top shelf book-like objects */}
      {[-0.5, -0.28, -0.06, 0.16, 0.38].map((x, i) => (
        <mesh key={i} position={[x, 0.57, 0.06]}>
          <boxGeometry args={[0.14, 0.22, 0.12]} />
          <meshStandardMaterial
            color={['#1A3A5A','#2A4060','#0D2030','#1C3550','#243040'][i]}
            metalness={0.1}
            roughness={0.85}
          />
        </mesh>
      ))}
    </group>
  )
}

export default function Interior() {
  return (
    <group>
      {/* ── Floor ─────────────────────────────────────────────────────── */}
      {/* Base floor disc */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[7.8, 64]} />
        <meshStandardMaterial color="#141E28" roughness={0.75} metalness={0.05} />
      </mesh>

      {/* Subtle tile shimmer overlay */}
      <mesh position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[7.8, 64]} />
        <meshBasicMaterial color="#4FACFE" transparent opacity={0.025} />
      </mesh>

      {/* Concentric floor rings — tighter spacing */}
      {[1.2, 2.4, 3.6, 4.8, 6.0, 7.2].map((r, i) => (
        <mesh key={i} position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[r - 0.025, r, 80]} />
          <meshBasicMaterial color="#4FACFE" transparent opacity={i % 2 === 0 ? 0.07 : 0.04} />
        </mesh>
      ))}

      {/* Crosshair radial lines on floor */}
      {[0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4].map((angle, i) => (
        <mesh key={`radial-${i}`} position={[0, 0.007, 0]} rotation={[-Math.PI / 2, 0, angle]}>
          <planeGeometry args={[0.025, 15.4]} />
          <meshBasicMaterial color="#4FACFE" transparent opacity={0.05} />
        </mesh>
      ))}

      {/* Center compass rose disc */}
      <mesh position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.28, 0.38, 32]} />
        <meshBasicMaterial color="#4FACFE" transparent opacity={0.18} />
      </mesh>

      {/* ── Cylindrical Walls ──────────────────────────────────────── */}
      {/*
        Strategy: split each shell into TWO cylinders—
          - Bottom (height=DOOR_H): has the door gap at phi=0
          - Top  (height=8−DOOR_H): full circle, covers above door
        Exterior r=8.5 extends 1 unit ABOVE dome equator (to y=9) so
        the dome sphere (r=8) visually sits inside the walls from outside.
      */}

      {/* EXTERIOR — bottom section (door gap) */}
      <mesh position={[0, DOOR_H / 2, 0]}>
        <cylinderGeometry args={[8.5, 8.5, DOOR_H, 64, 1, true, GAP_ANGLE, Math.PI * 2 - GAP_ANGLE * 2]} />
        <meshStandardMaterial color="#1A2E3E" roughness={0.75} metalness={0.05} side={THREE.FrontSide} />
      </mesh>
      {/* EXTERIOR — top section (above door, solid wall all the way to y=9) */}
      <mesh position={[0, DOOR_H + (9 - DOOR_H) / 2, 0]}>
        <cylinderGeometry args={[8.5, 8.5, 9 - DOOR_H, 64, 1, true]} />
        <meshStandardMaterial color="#1A2E3E" roughness={0.75} metalness={0.05} side={THREE.FrontSide} />
      </mesh>

      {/* INTERIOR — bottom section (door gap) */}
      <mesh position={[0, DOOR_H / 2, 0]}>
        <cylinderGeometry args={[8, 8, DOOR_H, 64, 1, true, GAP_ANGLE, Math.PI * 2 - GAP_ANGLE * 2]} />
        <meshStandardMaterial color="#1A2E3E" roughness={0.75} metalness={0.05} side={THREE.BackSide} />
      </mesh>
      {/* INTERIOR — top section (solid, above door) */}
      <mesh position={[0, DOOR_H + (8 - DOOR_H) / 2, 0]}>
        <cylinderGeometry args={[8, 8, 8 - DOOR_H, 64, 1, true]} />
        <meshStandardMaterial color="#1A2E3E" roughness={0.75} metalness={0.05} side={THREE.BackSide} />
      </mesh>

      {/* Tapered junction collar — open-ended so it doesn’t cap the dome opening */}
      <mesh position={[0, 9, 0]}>
        <cylinderGeometry args={[8, 8.5, 1.0, 64, 1, true]} />
        <meshStandardMaterial color="#1A2E3E" roughness={0.75} metalness={0.05} side={THREE.FrontSide} />
      </mesh>

      {/* Parapet ring — a flat ledge at the dome/wall junction visible from outside.
          Radius 9.0, wider than the dome sphere (r=8), makes walls clearly enclose dome. */}
      <mesh position={[0, 8.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[8, 9.0, 64]} />
        <meshStandardMaterial color="#162535" metalness={0.70} roughness={0.30} side={THREE.DoubleSide} />
      </mesh>
      {/* Parapet outer edge lip */}
      <mesh position={[0, 8.02, 0]}>
        <torusGeometry args={[9.0, 0.18, 8, 64]} />
        <meshStandardMaterial color="#243548" metalness={0.80} roughness={0.20} />
      </mesh>

      {/* Wall mid-rail — also gapped so it doesn't cross the doorway */}
      <mesh position={[0, 3.0, 0]}>
        <cylinderGeometry args={[7.96, 7.96, 0.12, 64, 1, true, GAP_ANGLE, Math.PI * 2 - GAP_ANGLE * 2]} />
        <meshStandardMaterial color="#243548" metalness={0.6} roughness={0.35} side={THREE.BackSide} />
      </mesh>
      {/* Wall base skirting board — gapped */}
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[7.96, 7.96, 0.5, 64, 1, true, GAP_ANGLE, Math.PI * 2 - GAP_ANGLE * 2]} />
        <meshStandardMaterial color="#1A2838" metalness={0.5} roughness={0.4} side={THREE.BackSide} />
      </mesh>
      {/* Wall top trim — above door height, full ring */}
      <mesh position={[0, 7.85, 0]}>
        <cylinderGeometry args={[7.96, 7.96, 0.12, 64, 1, true]} />
        <meshStandardMaterial color="#243548" metalness={0.6} roughness={0.35} side={THREE.BackSide} />
      </mesh>

      {/* Vertical pilasters */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * Math.PI * 2
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * 7.7, 4, Math.sin(angle) * 7.7]}
            rotation={[0, -angle, 0]}
          >
            <boxGeometry args={[0.14, 8, 0.18]} />
            <meshStandardMaterial color="#1E3248" metalness={0.6} roughness={0.4} />
          </mesh>
        )
      })}

      {/* Panel insets between pilasters (lower section) */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = ((i + 0.5) / 12) * Math.PI * 2
        return (
          <mesh
            key={`panel-${i}`}
            position={[Math.cos(angle) * 7.82, 1.5, Math.sin(angle) * 7.82]}
            rotation={[0, -angle, 0]}
          >
            <boxGeometry args={[1.4, 2.6, 0.06]} />
            <meshStandardMaterial color="#17293A" metalness={0.3} roughness={0.7} side={THREE.BackSide} />
          </mesh>
        )
      })}

      {/* ── Dome ───────────────────────────────────────────────────────── */}
      <group position={[0, 8, 0]}>
        <Dome radius={8} />
      </group>

      {/* Stars visible through dome slit */}
      <Stars radius={100} depth={50} count={4000} factor={3.5} saturation={0.05} fade />

      {/* ── Door ── */}
      <Door />

      {/* ── Telescope ── */}
      <Telescope />

      {/* ── Control Console ───────────────────────────────────────────── */}
      <group position={[0, 0, -4.2]}>
        {/* Console body */}
        <mesh position={[0, 0.85, 0]}>
          <boxGeometry args={[3.4, 1.7, 0.75]} />
          <meshStandardMaterial color="#0D1C2C" metalness={0.65} roughness={0.38} />
        </mesh>
        {/* Console angled top surface */}
        <mesh position={[0, 1.78, 0.12]} rotation={[-0.4, 0, 0]}>
          <boxGeometry args={[3.35, 0.75, 0.08]} />
          <meshStandardMaterial color="#0A1828" metalness={0.55} roughness={0.45} />
        </mesh>
        {/* Main monitor screen */}
        <mesh position={[0, 1.4, 0.39]}>
          <planeGeometry args={[2.4, 0.85]} />
          <meshBasicMaterial color="#0A3060" />
        </mesh>
        {/* Screen content — grid lines */}
        <mesh position={[0, 1.4, 0.395]}>
          <planeGeometry args={[2.35, 0.80]} />
          <meshBasicMaterial color="#1A80FF" transparent opacity={0.12} wireframe />
        </mesh>
        {/* Screen glow */}
        <mesh position={[0, 1.4, 0.392]}>
          <planeGeometry args={[2.36, 0.81]} />
          <meshBasicMaterial color="#4FACFE" transparent opacity={0.06} />
        </mesh>
        <pointLight position={[0, 1.4, 0.8]} color="#4FACFE" intensity={1.2} distance={4} decay={2} />

        {/* Keyboard area */}
        <mesh position={[0, 1.75, 0.32]} rotation={[-0.4, 0, 0]}>
          <planeGeometry args={[1.8, 0.25]} />
          <meshStandardMaterial color="#0C1E30" metalness={0.5} roughness={0.5} />
        </mesh>

        {/* Status panel — right side */}
        <mesh position={[1.35, 1.1, 0.39]}>
          <planeGeometry args={[0.55, 0.55]} />
          <meshBasicMaterial color="#020810" />
        </mesh>
        {/* Status indicator lights */}
        <IndicatorLight position={[1.18, 1.28, 0.40]} color="#00FF44" />
        <IndicatorLight position={[1.35, 1.28, 0.40]} color="#4FACFE" />
        <IndicatorLight position={[1.52, 1.28, 0.40]} color="#FF6B35" intensity={0.4} />
        <IndicatorLight position={[1.18, 1.10, 0.40]} color="#4FACFE" intensity={0.5} />
        <IndicatorLight position={[1.35, 1.10, 0.40]} color="#00FF44" intensity={0.5} />
        <IndicatorLight position={[1.52, 1.10, 0.40]} color="#4FACFE" intensity={0.5} />

        {/* Control dials — left side */}
        {[-1.25, -1.0, -0.75].map((x, i) => (
          <mesh key={i} position={[x, 1.05, 0.40]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.04, 14]} />
            <meshStandardMaterial color="#8AAFCC" metalness={0.9} roughness={0.1} />
          </mesh>
        ))}

        {/* Console side panels */}
        {[-1.71, 1.71].map((x, i) => (
          <mesh key={i} position={[x, 0.85, 0]}>
            <boxGeometry args={[0.03, 1.7, 0.75]} />
            <meshStandardMaterial color="#162535" metalness={0.7} roughness={0.3} />
          </mesh>
        ))}
      </group>

      {/* ── Equipment Shelves ─────────────────────────────────────────── */}
      <ShelfUnit
        position={[Math.cos(Math.PI * 0.65) * 7.3, 2.2, Math.sin(Math.PI * 0.65) * 7.3]}
        rotation={[0, -Math.PI * 0.65, 0]}
      />
      <ShelfUnit
        position={[Math.cos(Math.PI * 1.35) * 7.3, 2.2, Math.sin(Math.PI * 1.35) * 7.3]}
        rotation={[0, -Math.PI * 1.35, 0]}
      />

      {/* ── Star Chart Panel ──────────────────────────────────────────── */}
      <group
        position={[Math.cos(Math.PI * 0.85) * 7.6, 5.0, Math.sin(Math.PI * 0.85) * 7.6]}
        rotation={[0, -Math.PI * 0.85, 0]}
      >
        {/* Frame */}
        <mesh>
          <boxGeometry args={[1.8, 1.2, 0.06]} />
          <meshStandardMaterial color="#0D1C2C" metalness={0.5} roughness={0.5} />
        </mesh>
        {/* Chart surface */}
        <mesh position={[0, 0, 0.04]}>
          <planeGeometry args={[1.65, 1.08]} />
          <meshBasicMaterial color="#020A18" />
        </mesh>
        {/* Constellation lines (emissive) */}
        <mesh position={[0, 0, 0.045]}>
          <planeGeometry args={[1.60, 1.02]} />
          <meshBasicMaterial color="#2266AA" transparent opacity={0.28} wireframe />
        </mesh>
        <pointLight position={[0, 0, 0.4]} color="#3388DD" intensity={0.5} distance={2.5} decay={2} />
      </group>

      {/* ── Observation Bench ─────────────────────────────────────────── */}
      <mesh position={[0, 0.28, 5.5]} receiveShadow>
        <boxGeometry args={[3.2, 0.55, 0.65]} />
        <meshStandardMaterial color="#0D1820" roughness={0.85} metalness={0.1} />
      </mesh>
      {/* Bench legs */}
      {[[-1.3, 5.2], [1.3, 5.2], [-1.3, 5.8], [1.3, 5.8]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.12, z]}>
          <cylinderGeometry args={[0.05, 0.05, 0.24, 8]} />
          <meshStandardMaterial color="#0A1218" metalness={0.5} roughness={0.5} />
        </mesh>
      ))}

      {/* ── Lighting ──────────────────────────────────────────────────── */}

      {/* Bright ambient */}
      <ambientLight color="#C8DCFF" intensity={4.0} />

      {/* Main cool overhead fill — strong enough to read by */}
      <pointLight position={[0, 6, 0]} color="#D8EAFF" intensity={8.0} distance={22} decay={1.5} />

      {/* Spotlight on telescope */}
      <spotLight
        position={[0, 7.5, 0]}
        angle={0.85}
        penumbra={0.5}
        intensity={12}
        color="#E0EEFF"
        castShadow
        shadow-mapSize={[512, 512]}
      />

      {/* Red night-vision accent (astronomers use red to preserve dark adaptation) */}
      <pointLight position={[0, 1.2, -4.5]} color="#CC2200" intensity={1.8} distance={6} decay={2} />
      <pointLight position={[0, 1.2, 5.5]}  color="#AA1800" intensity={1.2} distance={5} decay={2} />

      {/* Console blue glow fill */}
      <pointLight position={[0, 2.5, -4]}   color="#4FACFE" intensity={1.5} distance={8} decay={2} />

      {/* Wall sconces — now with cone geometry for uplighting effect */}
      {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((angle, i) => (
        <group
          key={`sconce-${i}`}
          position={[Math.cos(angle) * 7.4, 5.2, Math.sin(angle) * 7.4]}
          rotation={[0, -angle, 0]}
        >
          {/* Sconce housing box */}
          <mesh>
            <boxGeometry args={[0.5, 0.12, 0.12]} />
            <meshStandardMaterial color="#1E3248" metalness={0.8} roughness={0.2} />
          </mesh>
          {/* Upward cone reflector */}
          <mesh position={[0, 0.14, 0]}>
            <coneGeometry args={[0.22, 0.22, 12, 1, true]} />
            <meshStandardMaterial color="#243040" metalness={0.7} roughness={0.3} side={THREE.BackSide} />
          </mesh>
          {/* Emissive glow bar */}
          <mesh position={[0, 0.07, 0]}>
            <boxGeometry args={[0.42, 0.03, 0.03]} />
            <meshBasicMaterial color="#B8D8FF" />
          </mesh>
          <pointLight color="#AACFEE" intensity={3.5} distance={12} decay={1.8} />
        </group>
      ))}

      {/* Exterior hill silhouette */}
      <mesh position={[0, -120, 0]}>
        <sphereGeometry args={[120, 64, 64, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#070A0D" roughness={1.0} metalness={0.0} />
      </mesh>
    </group>
  )
}
