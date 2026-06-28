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
  // ── Ground ──
  const groundGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(340, 340, 150, 150)
    g.rotateX(-Math.PI / 2)
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) p.setY(i, groundHeight(p.getX(i), p.getZ(i)))
    g.computeVertexNormals()
    return g
  }, [])

  // ── Grass tufts (instanced thin cones) ──
  const grass = useMemo(() => {
    const count = 2400
    const blade = new THREE.ConeGeometry(0.05, 0.6, 3, 1, true)
    blade.translate(0, 0.3, 0)
    const mesh = new THREE.InstancedMesh(
      blade, new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 }), count)
    const r = makeRng(7)
    const d = new THREE.Object3D()
    const c = new THREE.Color()
    let n = 0, guard = 0
    while (n < count && guard < count * 8) {
      guard++
      const ang = r() * Math.PI * 2
      const rad = 9.5 + Math.pow(r(), 0.7) * 62
      const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad
      if (onPath(x, z)) continue
      d.position.set(x, groundHeight(x, z), z)
      d.rotation.set((r() - 0.5) * 0.35, r() * Math.PI * 2, (r() - 0.5) * 0.35)
      const s = 0.55 + r() * 1.0
      d.scale.set(s * (0.7 + r() * 0.5), s * (0.8 + r() * 0.9), s * (0.7 + r() * 0.5))
      d.updateMatrix()
      mesh.setMatrixAt(n, d.matrix)
      c.setHSL(0.30 + r() * 0.07, 0.45, 0.14 + r() * 0.12)
      mesh.setColorAt(n, c)
      n++
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

  // ── Path bed (dirt ribbon conforming to the ground) ──
  const pathGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(PATH_HALF * 2, PATH_Z1 - PATH_Z0, 6, 48)
    g.rotateX(-Math.PI / 2)
    const cz = (PATH_Z0 + PATH_Z1) / 2
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i) + cz
      p.setZ(i, z)
      p.setY(i, groundHeight(x, z) + 0.04)
    }
    g.computeVertexNormals()
    return g
  }, [])

  // ── Flagstones along the path ──
  const stones = useMemo(() => {
    const mesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.55, 0.55, 0.08, 7),
      new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.05 }), 64)
    const r = makeRng(53)
    const d = new THREE.Object3D()
    const c = new THREE.Color()
    let n = 0
    for (let z = PATH_Z0 + 1; z < PATH_Z1 - 1 && n < 64; z += 1.35) {
      for (const side of [-0.75, 0.75]) {
        const x = side + (r() - 0.5) * 0.5
        const zz = z + (r() - 0.5) * 0.5
        d.position.set(x, groundHeight(x, zz) + 0.06, zz)
        d.rotation.set(0, r() * Math.PI, 0)
        const s = 0.85 + r() * 0.4
        d.scale.set(s, 1, s * (0.8 + r() * 0.4))
        d.updateMatrix()
        mesh.setMatrixAt(n, d.matrix)
        const g = 0.18 + r() * 0.08
        c.setRGB(g, g, g * 0.96)
        mesh.setColorAt(n, c)
        n++
      }
    }
    mesh.count = n
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    return mesh
  }, [])

  return (
    <group>
      {/* dim moonlight to give the ground form over the flat ambient */}
      <directionalLight position={[-30, 40, 25]} intensity={1.4} color="#9DB4D8" />

      <mesh geometry={groundGeo} receiveShadow>
        <meshStandardMaterial color="#1C3322" roughness={1} metalness={0} />
      </mesh>
      <mesh geometry={pathGeo}>
        <meshStandardMaterial color="#2C2A22" roughness={1} metalness={0} />
      </mesh>
      <primitive object={stones} />
      <primitive object={rocks} />
      <primitive object={grass} />
    </group>
  )
}
