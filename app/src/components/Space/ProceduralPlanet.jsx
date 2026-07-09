'use client'

/**
 * ProceduralPlanet — Full GLSL shader planet generator.
 * Renders Earth-like, hot, icy, and lava worlds based on temperature data.
 * - fBm (fractional Brownian motion) terrain
 * - Ocean / terrain / ice color blending
 * - Fresnel atmospheric glow
 * - Animated cloud layer
 * - Real-time rotation
 */
import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ── Full 3D Simplex Noise (GLSL) ──────────────────────────────────────────
const SIMPLEX_NOISE_GLSL = `
vec3 mod289v3(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 mod289v4(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289v4(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314*r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289v3(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}

float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  float f = 1.0;
  for(int i = 0; i < 6; i++) {
    v += a * snoise(p * f);
    f *= 2.0;
    a *= 0.5;
  }
  return v * 0.5 + 0.5;
}
`

// ── Planet Vertex Shader ───────────────────────────────────────────────────
const planetVertexShader = `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vWorldNormal;
varying vec3 vViewDir;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vPosition = position;
  vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vViewDir = normalize(cameraPosition - worldPos.xyz);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

// ── Planet Fragment Shader ─────────────────────────────────────────────────
const planetFragmentShader = `
${SIMPLEX_NOISE_GLSL}

uniform float uTime;
uniform float uNoiseScale;
uniform float uSeed;
uniform vec3 uOceanColor;
uniform vec3 uTerrainColor;
uniform vec3 uIceColor;
uniform vec3 uAtmosphereColor;
uniform float uAtmosphereThickness;
uniform float uSurfaceStyle;   // 0 = terran, 1 = banded (gas/ice giant), 2 = lava
uniform vec3 uBandColorA;
uniform vec3 uBandColorB;
uniform float uPolarIce;       // 1 = polar ice caps, 0 = none (airless rock)
uniform float uPlanetFeature;  // 0=none, 1=neptune, 2=jupiter, 3=saturn, 4=earth

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vWorldNormal;
varying vec3 vViewDir;

// ── Earth continent field (Gaussian influence + noise → fractal coastlines) ──
float earthContinent(vec3 nDir) {
  float lat = asin(nDir.y);
  float lon = atan(nDir.z, nDir.x);

  // Soft Gaussian influence: high near continents, zero in open ocean
  float inf = 0.0;

  // Africa (elongated N-S)
  inf = max(inf, 0.92*exp(-3.0*(pow((lon-0.30)/0.40,2.0)+pow((lat-0.08)/0.52,2.0))));
  inf = max(inf, 0.70*exp(-5.0*(pow((lon+0.02)/0.18,2.0)+pow((lat-0.10)/0.16,2.0))));
  inf = max(inf, 0.55*exp(-7.0*(pow((lon-0.78)/0.12,2.0)+pow((lat-0.06)/0.10,2.0))));
  inf = max(inf, 0.45*exp(-8.0*(pow((lon-0.82)/0.06,2.0)+pow((lat+0.35)/0.12,2.0))));

  // Europe
  inf = max(inf, 0.72*exp(-4.5*(pow((lon-0.12)/0.28,2.0)+pow((lat-0.82)/0.18,2.0))));
  inf = max(inf, 0.55*exp(-6.0*(pow((lon-0.22)/0.12,2.0)+pow((lat-1.08)/0.14,2.0))));
  inf = max(inf, 0.40*exp(-10.0*(pow((lon+0.05)/0.05,2.0)+pow((lat-0.93)/0.06,2.0))));
  inf = max(inf, 0.50*exp(-7.0*(pow((lon+0.06)/0.08,2.0)+pow((lat-0.70)/0.08,2.0))));
  inf = max(inf, 0.42*exp(-9.0*(pow((lon-0.22)/0.05,2.0)+pow((lat-0.72)/0.09,2.0))));

  // Asia (massive, many overlapping blobs)
  inf = max(inf, 0.95*exp(-1.2*(pow((lon-1.20)/0.90,2.0)+pow((lat-0.92)/0.30,2.0))));
  inf = max(inf, 0.78*exp(-2.5*(pow((lon-1.88)/0.38,2.0)+pow((lat-0.55)/0.30,2.0))));
  inf = max(inf, 0.72*exp(-5.0*(pow((lon-1.35)/0.14,2.0)+pow((lat-0.25)/0.25,2.0))));
  inf = max(inf, 0.60*exp(-4.5*(pow((lon-1.78)/0.16,2.0)+pow((lat-0.15)/0.18,2.0))));
  inf = max(inf, 0.60*exp(-5.5*(pow((lon-0.80)/0.14,2.0)+pow((lat-0.36)/0.14,2.0))));
  inf = max(inf, 0.65*exp(-4.0*(pow((lon-0.55)/0.28,2.0)+pow((lat-0.60)/0.16,2.0))));
  inf = max(inf, 0.40*exp(-5.0*(pow((lon-1.92)/0.30,2.0)+pow((lat+0.08)/0.06,2.0))));
  inf = max(inf, 0.38*exp(-9.0*(pow((lon-2.40)/0.06,2.0)+pow((lat-0.62)/0.15,2.0))));

  // North America
  inf = max(inf, 0.88*exp(-2.0*(pow((lon+1.65)/0.55,2.0)+pow((lat-0.85)/0.30,2.0))));
  inf = max(inf, 0.70*exp(-3.5*(pow((lon+1.50)/0.35,2.0)+pow((lat-0.55)/0.18,2.0))));
  inf = max(inf, 0.55*exp(-5.0*(pow((lon+1.78)/0.14,2.0)+pow((lat-0.35)/0.16,2.0))));
  inf = max(inf, 0.55*exp(-5.5*(pow((lon+2.62)/0.20,2.0)+pow((lat-1.10)/0.12,2.0))));
  inf = max(inf, 0.60*exp(-5.0*(pow((lon+0.72)/0.17,2.0)+pow((lat-1.20)/0.14,2.0))));

  // South America
  inf = max(inf, 0.82*exp(-2.5*(pow((lon+0.88)/0.25,2.0)+pow((lat+0.15)/0.48,2.0))));
  inf = max(inf, 0.60*exp(-5.0*(pow((lon+1.22)/0.18,2.0)+pow((lat-0.08)/0.12,2.0))));
  inf = max(inf, 0.50*exp(-5.0*(pow((lon+1.15)/0.10,2.0)+pow((lat+0.70)/0.22,2.0))));

  // Australia
  inf = max(inf, 0.70*exp(-3.5*(pow((lon-2.32)/0.30,2.0)+pow((lat+0.42)/0.18,2.0))));
  inf = max(inf, 0.32*exp(-9.0*(pow((lon-2.95)/0.05,2.0)+pow((lat+0.68)/0.08,2.0))));

  // Antarctica
  inf = max(inf, 0.85*exp(-4.5*pow((lat+1.30)/0.22,2.0)));

  // Fine noise perturbs the coastline threshold — not the shape
  float cn = snoise(nDir * 12.0) * 0.05;
  float land = smoothstep(0.34 + cn, 0.42 + cn, inf);
  return clamp(land, 0.0, 1.0);
}

void main() {
  // Generate terrain height using fBm
  vec3 samplePos = vPosition * uNoiseScale + vec3(uSeed * 13.7, uSeed * 7.3, uSeed * 19.1);
  float terrain = fbm(samplePos);

  // Latitude-based polar ice (abs(y) > 0.75 → poles)
  float latitude = abs(normalize(vPosition).y);
  float poleBlend = smoothstep(0.65, 0.82, latitude);

  // — Terran surface (rocky/ocean worlds) —
  float oceanMask = smoothstep(0.42, 0.48, terrain);
  vec3 terran = mix(uOceanColor, uTerrainColor, oceanMask);
  terran = mix(terran, uIceColor, poleBlend * uPolarIce);

  // — Banded surface (gas / ice giants): latitude bands warped by turbulence,
  //   plus a couple of swirling storm ovals. —
  float signedLat = normalize(vPosition).y;
  float warp = fbm(samplePos * 0.6) * 2.0;
  float bandPattern = sin(signedLat * 16.0 + warp + uTime * 0.05);
  float bandMix = smoothstep(-0.25, 0.25, bandPattern);
  vec3 banded = mix(uBandColorA, uBandColorB, bandMix);
  float storm = fbm(samplePos * 3.0 + vec3(11.0));
  banded = mix(banded, uBandColorB * 1.4, smoothstep(0.78, 0.92, storm) * 0.6);

  // — Lava surface: dark crust fractured by glowing molten channels. —
  float crackMask = smoothstep(0.52, 0.40, terrain);
  vec3 lava = mix(uTerrainColor, uOceanColor, crackMask);
  vec3 lavaEmissive = uOceanColor * crackMask * 2.2 + uIceColor * pow(crackMask, 3.0);

  // Select surface by style.
  vec3 surface;
  vec3 emissive = vec3(0.0);
  if (uSurfaceStyle < 0.5) {
    surface = terran;
  } else if (uSurfaceStyle < 1.5) {
    surface = banded;
  } else {
    surface = lava;
    emissive = lavaEmissive;
  }

  // ── Planet-specific features ──
  if (uPlanetFeature > 0.5) {
    vec3 nDir = normalize(vPosition);
    float pLat = asin(nDir.y);
    float pLon = atan(nDir.z, nDir.x);

    if (uPlanetFeature < 1.5) {
      // Neptune Great Dark Spot
      float dLat = (pLat + 0.35) * 2.8;
      float dLon = (pLon - 0.5) * 1.6;
      float sDist = sqrt(dLat*dLat + dLon*dLon);
      float sMask = 1.0 - smoothstep(0.3, 0.65, sDist);
      float sTurb = snoise(nDir * 6.0 + vec3(uTime * 0.02)) * 0.15;
      surface = mix(surface, surface * (0.25 + sTurb), sMask);
      // Bright companion cloud
      float cDist = length(vec2((pLat + 0.17) * 4.0, (pLon - 0.85) * 3.0));
      float cMask = (1.0 - smoothstep(0.2, 0.5, cDist)) * 0.35;
      surface = mix(surface, vec3(0.55, 0.65, 0.8), cMask);

    } else if (uPlanetFeature < 2.5) {
      // Jupiter Great Red Spot
      float dLat = (pLat + 0.38) * 2.2;
      float dLon = (pLon - 1.0) * 1.4;
      float sDist = sqrt(dLat*dLat + dLon*dLon);
      float sMask = 1.0 - smoothstep(0.28, 0.6, sDist);
      float sAngle = atan(dLat, dLon);
      float swirl = snoise(vec3(cos(sAngle)*sDist*3.0, sin(sAngle)*sDist*3.0, uTime*0.015)) * 0.25;
      vec3 redCol = mix(vec3(0.72, 0.25, 0.12), vec3(0.88, 0.45, 0.22), swirl + 0.5);
      float inner = 1.0 - smoothstep(0.15, 0.40, sDist);
      redCol = mix(redCol, redCol * 0.75, inner * 0.4);
      surface = mix(surface, redCol, sMask);

    } else if (uPlanetFeature < 3.5) {
      // Saturn Polar Hexagon (proper hexagonal polar boundary)
      float poleLat = abs(nDir.y);
      if (poleLat > 0.86) {
        float theta = atan(nDir.x, nDir.z);
        float pDist = acos(clamp(abs(nDir.y), 0.0, 1.0));
        // Proper hexagon: modular angle fold into one sextant
        float hexAngle = mod(theta + 0.5236, 1.0472) - 0.5236;
        float baseR = 0.11;
        float hexR = baseR / max(cos(hexAngle), 0.55);
        float hexEdge = smoothstep(hexR - 0.014, hexR, pDist)
                      * (1.0 - smoothstep(hexR, hexR + 0.014, pDist));
        float hexIn = 1.0 - smoothstep(0.0, hexR, pDist);
        float hexT = fbm(nDir * 18.0 + vec3(uTime * 0.04)) * 0.35;
        // Slightly blue-tinted interior
        vec3 hexInterior = surface * vec3(0.82, 0.88, 1.05) * (0.55 + hexT);
        surface = mix(surface, hexInterior, hexIn * 0.55);
        // Blue-gray hexagonal edge
        surface = mix(surface, vec3(0.72, 0.82, 0.92), hexEdge * 0.7);
        float vortex = 1.0 - smoothstep(0.0, 0.025, pDist);
        surface = mix(surface, surface * vec3(0.35, 0.42, 0.55), vortex * 0.75);
      }

    } else if (uPlanetFeature < 4.5) {
      // Earth Realistic Continents
      float landMask = earthContinent(nDir);
      float terrainH = fbm(nDir * 4.0 + uSeed * 5.0);
      float desert = smoothstep(0.15, 0.4, abs(pLat)) * (1.0 - smoothstep(0.55, 0.8, abs(pLat)));
      desert *= smoothstep(0.45, 0.6, terrainH);
      vec3 greenLand = mix(uTerrainColor, vec3(0.18, 0.38, 0.12), 0.5);
      vec3 desertCol = vec3(0.62, 0.52, 0.32);
      vec3 mountCol = vec3(0.45, 0.38, 0.30);
      vec3 tColor = mix(greenLand, desertCol, desert);
      tColor = mix(tColor, mountCol, smoothstep(0.65, 0.78, terrainH) * 0.6);
      float iceBlend = smoothstep(1.05, 1.25, abs(pLat));
      tColor = mix(tColor, uIceColor, iceBlend);
      vec3 oceanCol = mix(uOceanColor * 0.8, uOceanColor * 1.3, smoothstep(0.3, 0.5, landMask) * 0.5);
      surface = mix(oceanCol, tColor, landMask);
      float oceanIce = smoothstep(1.15, 1.35, abs(pLat)) * (1.0 - landMask);
      surface = mix(surface, uIceColor * 0.95, oceanIce);
    }
  }

  // Diffuse lighting (simple directional from above-right)
  vec3 lightDir = normalize(vec3(1.0, 0.5, 0.8));
  float diffuse = max(dot(vNormal, lightDir), 0.0);
  float ambient = 0.12;
  float lighting = ambient + diffuse * 0.88;

  surface *= lighting;

  // Fresnel atmospheric glow
  float fresnel = pow(1.0 - max(dot(vWorldNormal, vViewDir), 0.0), 3.0);
  fresnel *= uAtmosphereThickness * 8.0;
  vec3 atmColor = uAtmosphereColor * fresnel;

  vec3 finalColor = surface + atmColor + emissive;

  gl_FragColor = vec4(finalColor, 1.0);
}
`

// ── Ring System Shader (Saturn-like banded rings) ──────────────────────────
const ringVertexShader = `
varying vec3 vLocal;
void main() {
  vLocal = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`
const ringFragmentShader = `
uniform vec3 uColor;
uniform float uInner;
uniform float uOuter;
uniform float uOpacity;
uniform float uSeed;
varying vec3 vLocal;
void main() {
  // RingGeometry is in the local XY plane (z = 0) — radius is xy, not xz.
  float r = length(vLocal.xy);
  float t = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);
  // Fine banded structure with a few darker gaps.
  float fine = 0.5 + 0.5 * sin(t * 90.0 + uSeed * 20.0);
  float gaps = smoothstep(0.05, 0.12, abs(fract(t * 5.0) - 0.5));
  float edge = smoothstep(0.0, 0.04, t) * (1.0 - smoothstep(0.93, 1.0, t));
  float a = uOpacity * edge * (0.45 + 0.55 * fine) * gaps;
  gl_FragColor = vec4(uColor * (0.7 + 0.3 * fine), a);
}
`

function RingSystem({ params }) {
  const radius = params?.radius ?? 1
  const inner = radius * (params?.ringInner ?? 1.4)
  const outer = radius * (params?.ringOuter ?? 2.2)
  const uniforms = useMemo(() => ({
    uColor: { value: params?.ringColor ?? new THREE.Color(0.82, 0.74, 0.6) },
    uInner: { value: inner },
    uOuter: { value: outer },
    uOpacity: { value: params?.ringOpacity ?? 0.6 },
    uSeed: { value: params?.terrainSeed ?? 0.5 },
  }), [params, inner, outer])
  return (
    // Nearly equatorial (slight tilt); the orbit camera's elevation shows it as
    // a flat ellipse around the planet rather than edge-on.
    <mesh rotation={[-Math.PI / 2 + 0.14, 0, 0.12]}>
      <ringGeometry args={[inner, outer, 160, 4]} />
      <shaderMaterial
        vertexShader={ringVertexShader}
        fragmentShader={ringFragmentShader}
        uniforms={uniforms}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}

// ── Cloud Vertex Shader ────────────────────────────────────────────────────
const cloudVertexShader = `
varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vNormal;
void main() {
  vUv = uv;
  vPosition = position;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

// ── Cloud Fragment Shader ──────────────────────────────────────────────────
const cloudFragmentShader = `
${SIMPLEX_NOISE_GLSL}

uniform float uTime;
uniform float uSeed;
uniform float uCoverage;

varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vNormal;

void main() {
  // Animated cloud pattern
  vec3 p = vPosition * 1.8 + vec3(uTime * 0.03, 0.0, 0.0) + uSeed * vec3(5.1, 3.7, 8.2);
  float cloud = fbm(p);
  float alpha = smoothstep(1.0 - uCoverage, 1.0, cloud);

  // Simple lighting
  vec3 lightDir = normalize(vec3(1.0, 0.5, 0.8));
  float diff = max(dot(vNormal, lightDir), 0.15);

  gl_FragColor = vec4(vec3(0.95, 0.96, 1.0) * diff, alpha * 0.85);
}
`

// ── Component ─────────────────────────────────────────────────────────────

export default function ProceduralPlanet({ params, position = [0, 0, 0] }) {
  const planetRef = useRef()
  const cloudRef = useRef()

  const surfaceStyleValue =
    params?.surfaceStyle === 'lava' ? 2 : params?.surfaceStyle === 'bands' ? 1 : 0

  const planetFeatureValue =
    params?.planetFeature === 'neptuneDarkSpot' ? 1 :
    params?.planetFeature === 'jupiterRedSpot' ? 2 :
    params?.planetFeature === 'saturnHexagon' ? 3 :
    params?.planetFeature === 'earthContinents' ? 4 : 0

  const planetUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uNoiseScale: { value: params?.noiseScale ?? 2 },
    uSeed: { value: params?.terrainSeed ?? 0.5 },
    uOceanColor: { value: params?.oceanColor ?? new THREE.Color(0.1, 0.3, 0.7) },
    uTerrainColor: { value: params?.terrainColor ?? new THREE.Color(0.3, 0.5, 0.2) },
    uIceColor: { value: params?.iceColor ?? new THREE.Color(0.9, 0.95, 1.0) },
    uAtmosphereColor: { value: params?.atmosphereColor ?? new THREE.Color(0.4, 0.65, 1.0) },
    // Airless bodies (hasAtmosphere === false) get zero atmospheric rim glow.
    uAtmosphereThickness: { value: params?.hasAtmosphere === false ? 0 : (params?.atmosphereThickness ?? 0.08) },
    uSurfaceStyle: { value: surfaceStyleValue },
    uBandColorA: { value: params?.bandColorA ?? new THREE.Color(0.6, 0.45, 0.3) },
    uBandColorB: { value: params?.bandColorB ?? new THREE.Color(0.8, 0.65, 0.45) },
    uPolarIce: { value: params?.polarIce === false ? 0 : 1 },
    uPlanetFeature: { value: planetFeatureValue },
  }), [params, surfaceStyleValue, planetFeatureValue])

  const cloudUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uSeed: { value: params?.terrainSeed ?? 0.5 },
    uCoverage: { value: params?.cloudCoverage ?? 0.4 },
  }), [params])

  const radius = params?.radius ?? 1

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (planetRef.current) {
      planetRef.current.rotation.y = t * (params?.rotationSpeed ?? 0.08)
      planetUniforms.uTime.value = t
    }
    if (cloudRef.current) {
      cloudRef.current.rotation.y = t * ((params?.rotationSpeed ?? 0.08) * 1.15)
      cloudUniforms.uTime.value = t
    }
  })

  return (
    <group position={position} rotation={[0, 0, params?.axialTilt ?? 0]}>
      {/* Planet surface */}
      <mesh ref={planetRef}>
        <sphereGeometry args={[radius, 64, 64]} />
        <shaderMaterial
          vertexShader={planetVertexShader}
          fragmentShader={planetFragmentShader}
          uniforms={planetUniforms}
        />
      </mesh>

      {/* Cloud layer */}
      {(params?.cloudCoverage ?? 0.4) > 0.05 && (
        <mesh ref={cloudRef}>
          <sphereGeometry args={[radius * 1.02, 48, 48]} />
          <shaderMaterial
            vertexShader={cloudVertexShader}
            fragmentShader={cloudFragmentShader}
            uniforms={cloudUniforms}
            transparent
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Atmosphere glow ring */}
      {(params?.hasAtmosphere ?? true) && (
        <mesh>
          <sphereGeometry args={[radius * 1.06, 32, 32]} />
          <meshBasicMaterial
            color={params?.atmosphereColor ?? new THREE.Color(0.4, 0.65, 1.0)}
            transparent
            opacity={0.04}
            side={THREE.BackSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Ring system (gas/ice giants) */}
      {params?.hasRings && <RingSystem params={params} />}
    </group>
  )
}
