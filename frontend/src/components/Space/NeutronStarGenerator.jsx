/**
 * NeutronStarGenerator — handles the three compact-star types:
 *   - NeutronStar: tiny dense white-blue star, strong glow, faint dipole field.
 *   - Pulsar: + rotating lighthouse beam cones, polar jets, fast brightness pulse.
 *   - Magnetar: + intense animated magnetic arcs and particle discharges.
 *
 * The magnetic axis is tilted from the spin axis, so spinning the beam group
 * produces the characteristic lighthouse sweep. Brightness pulses rapidly (the
 * design asks for sub-second pulses; we use a fast sine on the emissive term).
 */
import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Bright Fresnel core — small but blazing.
const coreVertex = /* glsl */ `
varying vec3 vN; varying vec3 vV;
void main(){
  vN = normalize(normalMatrix * normal);
  vec4 wp = modelMatrix * vec4(position,1.0);
  vV = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
}
`
const coreFragment = /* glsl */ `
uniform vec3 uColor; uniform vec3 uGlow; uniform float uPulse;
varying vec3 vN; varying vec3 vV;
void main(){
  float ndv = abs(dot(vN, vV));
  float core = pow(ndv, 0.4);
  float rim = pow(1.0 - ndv, 2.0);
  vec3 c = mix(uGlow, uColor, core) * (1.0 + uPulse * 0.8);
  c += uGlow * rim * 1.5;
  gl_FragColor = vec4(c, 1.0);
}
`

// Lighthouse beam — a tapered cone with an apex at the star, fading to the tip.
const beamFragment = /* glsl */ `
uniform vec3 uColor; uniform float uPulse;
varying vec2 vUv;
void main(){
  float along = vUv.y;               // 0 at star, 1 at tip
  float edge = abs(vUv.x - 0.5) * 2.0;
  float core = 1.0 - smoothstep(0.0, 1.0, edge);
  float fade = 1.0 - smoothstep(0.0, 1.0, along);
  float a = core * fade * (0.35 + 0.65 * uPulse);
  gl_FragColor = vec4(uColor * (1.5 + uPulse), a);
}
`
const beamVertex = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
`

function Beam({ params, pulseRef, dir = 1 }) {
  const matRef = useRef()
  const length = (params.radius ?? 0.5) * 14
  const uniforms = useMemo(() => ({
    uColor: { value: params.beamColor ?? new THREE.Color(0.75, 0.88, 1.0) },
    uPulse: { value: 1 },
  }), [params])
  useFrame(() => { if (matRef.current) matRef.current.uniforms.uPulse.value = pulseRef.current })
  // Cone apex at origin (flip so it widens outward), extending along ±Y.
  return (
    <mesh position={[0, (dir * length) / 2, 0]} rotation={[dir > 0 ? Math.PI : 0, 0, 0]}>
      <coneGeometry args={[length * 0.16, length, 24, 1, true]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={beamVertex}
        fragmentShader={beamFragment}
        uniforms={uniforms}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

// Dipole magnetic-field loops (a few tilted tori) — animated for magnetars.
function MagneticArcs({ params, arcs = false }) {
  const groupRef = useRef()
  const matRefs = useRef([])
  const r = params.radius ?? 0.5
  const rings = useMemo(() => [1.6, 2.4, 3.4].map((m, i) => ({ radius: r * m, i })), [r])
  useFrame((s) => {
    const t = s.clock.elapsedTime
    if (groupRef.current) groupRef.current.rotation.y = t * 0.4
    if (arcs) {
      matRefs.current.forEach((mat, i) => {
        if (mat) mat.opacity = 0.25 + 0.35 * Math.abs(Math.sin(t * 5 + i))
      })
    }
  })
  return (
    <group ref={groupRef}>
      {rings.map(({ radius, i }) => (
        <mesh key={i} rotation={[Math.PI / 2, 0, (i - 1) * 0.4]}>
          <torusGeometry args={[radius, 0.015 * r * 8, 8, 64]} />
          <meshBasicMaterial
            ref={(el) => (matRefs.current[i] = el)}
            color={arcs ? new THREE.Color(0.7, 0.85, 1.0) : new THREE.Color(0.4, 0.6, 1.0)}
            transparent
            opacity={arcs ? 0.5 : 0.25}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  )
}

export default function NeutronStarGenerator({ params, position = [0, 0, 0] }) {
  const coreRef = useRef()
  const beamGroupRef = useRef()
  const dischargeRef = useRef()
  const pulseRef = useRef(1)
  const r = params?.radius ?? 0.5

  const coreUniforms = useMemo(() => ({
    uColor: { value: params?.coreColor ?? new THREE.Color(0.7, 0.85, 1.0) },
    uGlow: { value: params?.glowColor ?? new THREE.Color(0.6, 0.8, 1.0) },
    uPulse: { value: 0 },
  }), [params])

  // Particle discharge field (magnetar) / sparse magnetospheric particles.
  const dischargeGeo = useMemo(() => {
    const count = 600
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const rad = r * (1.3 + Math.random() * 3.0)
      pos[i * 3] = rad * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = rad * Math.cos(phi)
      pos[i * 3 + 2] = rad * Math.sin(phi) * Math.sin(theta)
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return geo
  }, [r])

  useFrame((s) => {
    const t = s.clock.elapsedTime
    // Fast brightness pulse (lighthouse + emissive throb).
    const speed = params?.pulseSpeed ?? 6
    const pulse = params?.pulse ? Math.pow(0.5 + 0.5 * Math.sin(t * speed), 4) : 0.6
    pulseRef.current = pulse
    coreUniforms.uPulse.value = pulse
    if (beamGroupRef.current) beamGroupRef.current.rotation.y = t * (params?.rotationSpeed ?? 3)
    if (dischargeRef.current) dischargeRef.current.rotation.y = -t * 0.8
  })

  return (
    <group position={position}>
      {/* Dense core */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[r, 48, 48]} />
        <shaderMaterial
          vertexShader={coreVertex}
          fragmentShader={coreFragment}
          uniforms={coreUniforms}
        />
      </mesh>

      {/* Glow halo */}
      <mesh>
        <sphereGeometry args={[r * 1.6, 32, 32]} />
        <meshBasicMaterial
          color={params?.glowColor ?? new THREE.Color(0.6, 0.8, 1.0)}
          transparent
          opacity={0.25 * (params?.glowIntensity ?? 2) / 2}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Lighthouse beams + polar jets share a tilted, spinning magnetic axis */}
      {(params?.beams || params?.jets) && (
        <group ref={beamGroupRef} rotation={[0.5, 0, 0]}>
          {params?.beams && (
            <>
              <Beam params={params} pulseRef={pulseRef} dir={1} />
              <Beam params={params} pulseRef={pulseRef} dir={-1} />
            </>
          )}
        </group>
      )}

      {/* Magnetic field / arcs */}
      {params?.magneticField && <MagneticArcs params={params} arcs={params?.magneticArcs} />}

      {/* Particle discharges */}
      {params?.particleEffects && (
        <points ref={dischargeRef} geometry={dischargeGeo}>
          <pointsMaterial
            color={params?.beamColor ?? new THREE.Color(0.8, 0.9, 1.0)}
            size={0.04}
            sizeAttenuation
            transparent
            opacity={params?.magneticArcs ? 0.7 : 0.4}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </points>
      )}

      <pointLight
        color={params?.glowColor ?? new THREE.Color(0.7, 0.85, 1.0)}
        intensity={params?.glowIntensity ?? 2.5}
        distance={r * 40}
        decay={2}
      />
    </group>
  )
}
