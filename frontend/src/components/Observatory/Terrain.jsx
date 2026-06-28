/**
 * Terrain — the grassy hilltop the observatory stands on.
 *
 * Replaces the old flat dark silhouette dome with a rolling ground that domes
 * down away from the building, a flagstone path leading out to the door (+Z),
 * scattered instanced grass tufts and a few rocks. A dim "moonlight" gives the
 * surface some form on top of the scene's flat ambient light.
 */
import React, { useMemo } from 'react'
import * as THREE from 'three'
import { generateNoiseTexture } from '../../utils/proceduralTextures'

// Deterministic PRNG so the scatter is identical every render.
function makeRng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── Height field ───────────────────────────────────────────────────────────
const BASE_Y = -0.05   // sit just below the floor disc (avoids z-fighting)
const FLAT_R = 11      // keep the ground flat under/around the building

function rolling(x, z) {
  return (
    Math.sin(x * 0.28) * Math.cos(z * 0.24) * 0.5 +
    Math.sin(x * 0.12 + 1.7) * Math.sin(z * 0.10 - 0.5) * 0.9 +
    Math.cos(x * 0.06 - z * 0.08) * 0.6
  )
}
function groundHeight(x, z) {
  const d = Math.hypot(x, z)
  const beyond = Math.max(0, d - FLAT_R)
  const dome = -(beyond * beyond) / 300           // slopes away past the building
  const ramp = Math.min(beyond / 16, 1)           // ease the bumps in
  return BASE_Y + dome + rolling(x, z) * ramp
}

// ── Path corridor (straight, out the door at +Z) ───────────────────────────
const PATH_HALF = 1.7
const PATH_Z0 = 8.0
const PATH_Z1 = 46
function onPath(x, z) {
  return z > PATH_Z0 && z < PATH_Z1 && Math.abs(x) < PATH_HALF + 0.4
}

export default function Terrain() {
  // Tiled noise used as a bump map to give the grass & dirt surface texture.
  const grassBump = useMemo(() => {
    const t = generateNoiseTexture(256, 11)
    t.repeat.set(34, 34)
    return t
  }, [])
  const dirtBump = useMemo(() => {
    const t = generateNoiseTexture(256, 73)
    t.repeat.set(3, 26)
    return t
  }, [])

  // ── Ground (displaced + per-vertex colour variation: patchy grass + dirt) ──
  const groundGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(340, 340, 150, 150)
    g.rotateX(-Math.PI / 2)
    const p = g.attributes.position
    const col = new Float32Array(p.count * 3)
    const c = new THREE.Color()
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i)
      p.setY(i, groundHeight(x, z))
      // patchy green: low-freq patches + fine speckle
      const patch = 0.5 + 0.5 * Math.sin(x * 0.07 + 1.3) * Math.cos(z * 0.063)
      const fine = 0.5 + 0.5 * Math.sin(x * 0.9) * Math.sin(z * 0.8)
      const lum = 0.12 + patch * 0.10 + fine * 0.03
      c.setHSL(0.30 + patch * 0.05, 0.42 - fine * 0.1, lum)
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    g.computeVertexNormals()
    return g
  }, [])

  // ── Grass (instanced small blades, placed in tufts for a lush look) ──
  const grass = useMemo(() => {
    const maxBlades = 6500
    const blade = new THREE.ConeGeometry(0.04, 0.42, 3, 1, true)
    blade.translate(0, 0.21, 0)
    const mesh = new THREE.InstancedMesh(
      blade, new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 }), maxBlades)
    const r = makeRng(7)
    const d = new THREE.Object3D()
    const c = new THREE.Color()
    let n = 0
    for (let ci = 0; ci < 1100 && n < maxBlades; ci++) {
      const ang = r() * Math.PI * 2
      const rad = 9.5 + Math.pow(r(), 0.8) * 34      // concentrated near the building
      const cx = Math.cos(ang) * rad, cz = Math.sin(ang) * rad
      if (onPath(cx, cz)) continue
      const blades = 4 + Math.floor(r() * 5)         // 4–8 blades per tuft
      const hue = 0.30 + r() * 0.06
      for (let b = 0; b < blades && n < maxBlades; b++) {
        const x = cx + (r() - 0.5) * 0.5, z = cz + (r() - 0.5) * 0.5
        d.position.set(x, groundHeight(x, z), z)
        d.rotation.set((r() - 0.5) * 0.4, r() * Math.PI * 2, (r() - 0.5) * 0.4)
        const s = 0.6 + r() * 0.9
        d.scale.set(s * (0.7 + r() * 0.5), s, s * (0.7 + r() * 0.5))
        d.updateMatrix()
        mesh.setMatrixAt(n, d.matrix)
        c.setHSL(hue, 0.45, 0.13 + r() * 0.13)
        mesh.setColorAt(n, c)
        n++
      }
    }
    mesh.count = n
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    return mesh
  }, [])

  // ── Rocks (instanced low-poly) ──
  const rocks = useMemo(() => {
    const count = 46
    const mesh = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0.05, flatShading: true }),
      count)
    const r = makeRng(31)
    const d = new THREE.Object3D()
    const c = new THREE.Color()
    let n = 0, guard = 0
    while (n < count && guard < count * 10) {
      guard++
      const ang = r() * Math.PI * 2
      const rad = 12 + Math.pow(r(), 0.8) * 50
      const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad
      if (onPath(x, z)) continue
      const s = 0.25 + r() * 0.8
      d.position.set(x, groundHeight(x, z) + s * 0.25, z)
      d.rotation.set(r() * Math.PI, r() * Math.PI, r() * Math.PI)
      d.scale.set(s, s * (0.6 + r() * 0.5), s)
      d.updateMatrix()
      mesh.setMatrixAt(n, d.matrix)
      const g = 0.12 + r() * 0.1
      c.setRGB(g, g + 0.02, g + 0.05)
      mesh.setColorAt(n, c)
      n++
    }
    mesh.count = n
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    return mesh
  }, [])

  // ── Path bed (dirt/gravel ribbon conforming to the ground) ──
  const pathGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(PATH_HALF * 2, PATH_Z1 - PATH_Z0, 10, 90)
    g.rotateX(-Math.PI / 2)
    const cz = (PATH_Z0 + PATH_Z1) / 2
    const p = g.attributes.position
    const col = new Float32Array(p.count * 3)
    const c = new THREE.Color()
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i)
      const z = p.getZ(i) + cz
      p.setZ(i, z)
      p.setY(i, groundHeight(x, z) + 0.04)
      // speckled gravel colour
      const sp = 0.5 + 0.5 * Math.sin(x * 5.1 + z * 4.3) * Math.cos(z * 3.7 - x * 2.9)
      const v = 0.14 + sp * 0.12
      c.setRGB(v * 1.05, v, v * 0.85)            // warm dirt/gravel
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    g.computeVertexNormals()
    return g
  }, [])

  return (
    <group>
      {/* dim moonlight to give the ground form over the flat ambient */}
      <directionalLight position={[-30, 40, 25]} intensity={1.4} color="#9DB4D8" />

      <mesh geometry={groundGeo} receiveShadow>
        <meshStandardMaterial vertexColors roughness={1} metalness={0} bumpMap={grassBump} bumpScale={0.25} />
      </mesh>
      <mesh geometry={pathGeo}>
        <meshStandardMaterial vertexColors roughness={1} metalness={0} bumpMap={dirtBump} bumpScale={0.35} />
      </mesh>
      <primitive object={rocks} />
      <primitive object={grass} />
    </group>
  )
}
