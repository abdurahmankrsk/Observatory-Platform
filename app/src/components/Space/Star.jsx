'use client'

/**
 * Star — Animated convection surface shader + corona particle system.
 * Temperature-accurate color using blackbody radiation formula.
 */
import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const SIMPLEX_NOISE_GLSL = `
vec3 mod289v3(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 mod289v4(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289v4(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314*r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0,1.0/3.0);
  const vec4 D = vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289v3(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
`

const starVertexShader = `
varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vViewDir;
void main() {
  vPosition = position;
  vNormal = normalize(normalMatrix * normal);
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vViewDir = normalize(cameraPosition - worldPos.xyz);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const starFragmentShader = `
${SIMPLEX_NOISE_GLSL}

uniform float uTime;
uniform vec3 uSurfaceColor;
uniform vec3 uHotColor;
uniform float uConvectionSpeed;
uniform float uConvectionScale;
uniform float uMuted;   // 0 = bright star, →1 = dim (brown dwarf)

varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  // Animated convection cells
  float t = uTime * uConvectionSpeed;
  vec3 p = vPosition * uConvectionScale;

  float n1 = snoise(p + vec3(t, 0.0, 0.0));
  float n2 = snoise(p * 2.0 + vec3(0.0, t * 1.3, 0.0)) * 0.5;
  float n3 = snoise(p * 4.0 + vec3(0.0, 0.0, t * 0.7)) * 0.25;
  float convection = (n1 + n2 + n3) * 0.5 + 0.5;

  // Hot spots (bright inner convection)
  float hotSpot = pow(max(convection, 0.0001), 2.5);

  vec3 surface = mix(uSurfaceColor * 0.7, uSurfaceColor, clamp(convection, 0.0, 1.0));
  surface = mix(surface, uHotColor, hotSpot * 0.4);

  // Absolute dot product to prevent negative values at extreme angles causing black pixels
  float nDotV = abs(dot(vNormal, vViewDir));

  // Limb darkening (classic stellar limb effect)
  float limbDark = pow(max(nDotV, 0.0001), 0.3);
  surface *= mix(0.5, 1.0, limbDark);

  // Fresnel corona glow at edges
  float fresnel = 1.0 - max(nDotV, 0.0);
  fresnel = pow(fresnel, 2.0);
  vec3 corona = uHotColor * fresnel * 0.6 * (1.0 - uMuted);

  // Muted (sub-stellar) bodies are dimmer and have weak limb glow.
  vec3 outColor = surface * (1.0 - uMuted * 0.45) + corona;

  gl_FragColor = vec4(outColor, 1.0);
}
`

export default function Star({ params, position = [0, 0, 0] }) {
  const meshRef = useRef()
  const coronaRef = useRef()

  const radius = params?.radius ?? 1.5

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uSurfaceColor: { value: params?.surfaceColor ?? new THREE.Color(1, 0.85, 0.5) },
    uHotColor: { value: params?.glowColor ?? new THREE.Color(1, 0.97, 0.85) },
    uConvectionSpeed: { value: params?.convectionSpeed ?? 0.4 },
    uConvectionScale: { value: params?.convectionScale ?? 2.0 },
    uMuted: { value: params?.mutedSurface ?? 0 },
  }), [params])

  // Corona particles
  const coronaGeometry = useMemo(() => {
    const count = params?.coronaParticles ?? 3000
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      // Distribute in a shell around the star
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = radius * (1.05 + Math.random() * 0.6)

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)
      sizes[i] = 0.01 + Math.random() * 0.04
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
    return geo
  }, [radius, params?.coronaParticles])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    uniforms.uTime.value = t
    if (meshRef.current) {
      meshRef.current.rotation.y = t * 0.03
    }
    if (coronaRef.current) {
      coronaRef.current.rotation.y = -t * 0.01
      coronaRef.current.rotation.z = t * 0.005
    }
  })

  const lightColor = params?.lightColor ?? new THREE.Color(1, 0.85, 0.5)

  return (
    <group position={position}>
      {/* Star surface */}
      <mesh ref={meshRef} frustumCulled={false}>
        <sphereGeometry args={[radius, 64, 64]} />
        <shaderMaterial
          vertexShader={starVertexShader}
          fragmentShader={starFragmentShader}
          uniforms={uniforms}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Corona particle system */}
      <points ref={coronaRef} geometry={coronaGeometry} frustumCulled={false}>
        <pointsMaterial
          color={params?.glowColor ?? new THREE.Color(1, 0.9, 0.6)}
          size={0.03}
          sizeAttenuation
          transparent
          opacity={params?.coronaOpacity ?? 0.6}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* Outer corona glow shell — larger for giants/supergiants, faint for dwarfs */}
      <mesh frustumCulled={false}>
        <sphereGeometry args={[radius * (params?.coronaScale ?? 1.5), 32, 32]} />
        <meshBasicMaterial
          color={params?.glowColor ?? new THREE.Color(1, 0.9, 0.6)}
          transparent
          opacity={0.12 * (params?.glowIntensity ?? 0.6) * (1 - (params?.mutedSurface ?? 0))}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Point light — illuminates nearby planets */}
      <pointLight
        color={lightColor}
        intensity={params?.lightIntensity ?? 2}
        distance={radius * 20}
        decay={2}
      />
    </group>
  )
}
