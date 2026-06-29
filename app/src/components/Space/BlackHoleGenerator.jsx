'use client'

/**
 * BlackHoleGenerator — procedural black hole.
 *
 * Composes:
 *   - a pure-black event-horizon sphere (no surface, no atmosphere),
 *   - a shaded accretion disk with a temperature gradient + Doppler beaming
 *     (the side rotating toward the viewer is brighter) + turbulent noise,
 *   - a bright "photon ring" / lensing rim approximated with a back-side Fresnel
 *     shell (a full relativistic lensing shader is out of scope; this reads
 *     convincingly under the scene's bloom pass),
 *   - optional relativistic polar jets,
 *   - infalling particle effects spiralling into the disk plane.
 *
 * Disk brightness scales with whether the metadata suggested active accretion.
 */
import React, { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { SIMPLEX_3D } from '../../procedural/ShaderLibrary'

// ── Accretion disk shader ───────────────────────────────────────────────────
const diskVertex = /* glsl */ `
varying vec3 vLocalPos;
varying vec2 vUv;
void main() {
  vLocalPos = position;
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const diskFragment = /* glsl */ `
${SIMPLEX_3D}
uniform float uTime;
uniform float uInner;
uniform float uOuter;
uniform float uBrightness;
uniform vec3 uInnerColor;
uniform vec3 uMidColor;
uniform vec3 uOuterColor;
varying vec3 vLocalPos;

void main() {
  // RingGeometry lives in the local XY plane (z = 0), so the radius and angle
  // must come from xy — using xz collapses to |x| and produces vertical stripes.
  float r = length(vLocalPos.xy);
  float t = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);
  float angle = atan(vLocalPos.y, vLocalPos.x);

  // Temperature gradient: hot (white) inside → cool (red) outside.
  vec3 color = mix(uInnerColor, uMidColor, smoothstep(0.0, 0.5, t));
  color = mix(color, uOuterColor, smoothstep(0.5, 1.0, t));

  // Swirling turbulence — LOW frequency and low contrast on purpose. The
  // previous high-frequency swirl (angle*3, r*2, 28% noise) aliased against the
  // pixel grid as it animated, and the bloom pass amplified that sparkle into
  // the brief "flashes / explosions" around the horizon. Smooth, gentle bands
  // don't alias, so they don't flash.
  float swirl = angle * 2.0 - uTime * (0.9 - t * 0.5) - r * 1.0;
  float n = fbm(vec3(cos(swirl) * r * 0.5, sin(swirl) * r * 0.5, uTime * 0.04));
  float bands = 0.86 + 0.14 * n;

  // Doppler beaming: approaching side brightened, receding dimmed. Gentle so the
  // bright side is a soft gradient, never a blooming hotspot.
  float doppler = 0.84 + 0.3 * (0.5 + 0.5 * cos(angle - 1.5708));

  // Radial falloff: a WIDE inner ramp (no sharp bright lip against the black
  // horizon — that hard high-contrast edge was a second flash source) and a soft
  // outer edge.
  float inner = smoothstep(uInner, uInner + 0.6, r);
  float outer = 1.0 - smoothstep(uOuter - 1.2, uOuter, r);
  // Clamp the peak well down so no fragment can run away into a bloom flare.
  float intensity = min(inner * outer * bands * doppler * uBrightness, 1.1);

  float alpha = inner * outer * (0.7 + 0.3 * n);
  gl_FragColor = vec4(color * intensity, alpha);
}
`

// ── Polar jet shader (vertical glowing beam) ────────────────────────────────
const jetVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`
const jetFragment = /* glsl */ `
${SIMPLEX_3D}
uniform float uTime;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  // vUv.y runs base→tip; fade out toward the tip and the radial edge.
  float along = vUv.y;
  float edge = abs(vUv.x - 0.5) * 2.0;
  float core = 1.0 - smoothstep(0.0, 1.0, edge);
  float fade = 1.0 - smoothstep(0.0, 1.0, along);
  float flow = fbm(vec3(vUv.x * 4.0, vUv.y * 8.0 - uTime * 3.0, 0.0));
  float a = core * fade * (0.4 + 0.6 * flow) * 0.8;
  gl_FragColor = vec4(uColor * (1.2 + flow), a);
}
`

function Jet({ params, dir = 1 }) {
  const matRef = useRef()
  const length = params.jetLength ?? 8
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor: { value: params.jetColor ?? new THREE.Color(0.6, 0.8, 1.0) },
  }), [params])
  useFrame((s) => { if (matRef.current) matRef.current.uniforms.uTime.value = s.clock.elapsedTime })
  return (
    <mesh position={[0, (dir * length) / 2, 0]} rotation={[dir > 0 ? 0 : Math.PI, 0, 0]}>
      {/* narrow at the base, flaring toward the tip */}
      <cylinderGeometry args={[0.5, 0.08, length, 24, 1, true]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={jetVertex}
        fragmentShader={jetFragment}
        uniforms={uniforms}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

export default function BlackHoleGenerator({ params, position = [0, 0, 0] }) {
  const diskRef = useRef()
  const particlesRef = useRef()
  const photonRingRef = useRef()
  const { camera } = useThree()
  const r = params?.radius ?? 1

  const diskUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uInner: { value: params?.diskInner ?? r * 1.6 },
    uOuter: { value: params?.diskOuter ?? r * 4.5 },
    uBrightness: { value: params?.diskBrightness ?? 2.0 },
    uInnerColor: { value: params?.diskInnerColor ?? new THREE.Color(1, 0.95, 0.8) },
    uMidColor: { value: params?.diskMidColor ?? new THREE.Color(1, 0.55, 0.2) },
    uOuterColor: { value: params?.diskOuterColor ?? new THREE.Color(0.7, 0.15, 0.35) },
  }), [params, r])

  // Infalling particle field spiralling in the disk plane.
  const particleGeo = useMemo(() => {
    const count = 700
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(count * 3)
    const inner = params?.diskInner ?? r * 1.6
    const outer = params?.diskOuter ?? r * 4.5
    for (let i = 0; i < count; i++) {
      const radius = inner + Math.random() * (outer - inner)
      const a = Math.random() * Math.PI * 2
      pos[i * 3] = Math.cos(a) * radius
      pos[i * 3 + 1] = (Math.random() - 0.5) * 0.25
      pos[i * 3 + 2] = Math.sin(a) * radius
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return geo
  }, [params, r])

  useFrame((s) => {
    const t = s.clock.elapsedTime
    if (diskRef.current) diskRef.current.material.uniforms.uTime.value = t
    if (particlesRef.current) particlesRef.current.rotation.y = -t * 0.6
    // Make the photon ring always face the camera — rotate the ring plane so its
    // normal points at the camera, keeping it at the event-horizon silhouette.
    if (photonRingRef.current) {
      photonRingRef.current.quaternion.copy(camera.quaternion)
    }
  })

  const tilt = params?.diskTilt ?? 0.5

  return (
    <group position={position}>
      {/* Photon ring / event-horizon glow — OUTSIDE the tilted disk group so
          the billboard quaternion copy from useFrame isn't double-transformed
          by the disk tilt. Sits at the equator of the black sphere. */}
      <mesh ref={photonRingRef}>
        <ringGeometry args={[r * 1.0, r * 1.055, 192]} />
        <shaderMaterial
          vertexShader={`
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }`}
          fragmentShader={`
            varying vec2 vUv;
            void main() {
              float t = vUv.x;
              // Clamp to ensure the base is never negative (prevents NaN from pow)
              float glow = pow(max(0.0, 1.0 - t), 2.5);
              vec3 col = mix(vec3(0.9, 0.96, 1.0), vec3(0.55, 0.75, 1.0), t);
              gl_FragColor = vec4(col * glow, glow * 0.7);
            }`}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <group rotation={[tilt, 0, 0]}>
        {/* Event horizon — pure matte black sphere. depthWrite is true by default
            so it correctly occludes anything behind it, like the accretion disk
            and background stars. */}
        <mesh>
          <sphereGeometry args={[r, 64, 64]} />
          <meshBasicMaterial color="#000000" />
        </mesh>

        {/* Accretion disk (lies in the XZ plane) */}
        {params?.accretionDisk !== false && (
          <mesh ref={diskRef} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[params?.diskInner ?? r * 1.6, params?.diskOuter ?? r * 4.5, 128, 8]} />
            <shaderMaterial
              vertexShader={diskVertex}
              fragmentShader={diskFragment}
              uniforms={diskUniforms}
              transparent
              side={THREE.DoubleSide}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        )}

        {/* Infalling particles */}
        {params?.particleEffects && (
          <points ref={particlesRef} geometry={particleGeo}>
            <pointsMaterial
              color={params?.diskMidColor ?? new THREE.Color(1, 0.6, 0.2)}
              size={2.0}
              sizeAttenuation={false}
              transparent
              opacity={0.3}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </points>
        )}

        {/* Relativistic jets */}
        {params?.jets && (
          <>
            <Jet params={params} dir={1} />
            <Jet params={params} dir={-1} />
          </>
        )}
      </group>
    </group>
  )
}
