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

// ── Canvas textures (colour + relief) ───────────────────────────────────────
function makeGrassTexture() {
  const s = 256
  const cv = document.createElement('canvas'); cv.width = cv.height = s
  const x = cv.getContext('2d')
  x.fillStyle = '#223c27'; x.fillRect(0, 0, s, s)
  for (let i = 0; i < 150; i++) {              // soft darker/lighter patches
    const g = 40 + Math.random() * 70
    x.fillStyle = `rgba(${g * 0.55},${g},${g * 0.6},0.22)`
    x.beginPath(); x.arc(Math.random() * s, Math.random() * s, 8 + Math.random() * 40, 0, 7); x.fill()
  }
  for (let i = 0; i < 6000; i++) {             // blade speckle
    const g = 55 + Math.random() * 130
    x.fillStyle = `rgba(${g * 0.5},${g},${g * 0.55},${0.25 + Math.random() * 0.5})`
    x.fillRect(Math.random() * s, Math.random() * s, 1, 2 + Math.random() * 4)
  }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t
}
function makeDirtTexture() {
  const s = 256
  const cv = document.createElement('canvas'); cv.width = cv.height = s
  const x = cv.getContext('2d')
  x.fillStyle = '#3a3026'; x.fillRect(0, 0, s, s)
  for (let i = 0; i < 1400; i++) {             // pebbles / gravel
    const g = 50 + Math.random() * 90
    x.fillStyle = `rgba(${g},${g * 0.92},${g * 0.78},${0.3 + Math.random() * 0.5})`
    const r = 1 + Math.random() * 3.5
    x.beginPath(); x.arc(Math.random() * s, Math.random() * s, r, 0, 7); x.fill()
  }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t
}

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
  // Tiled canvas textures (used as colour map + bump for surface relief).
  const grassTex = useMemo(() => { const t = makeGrassTexture(); t.repeat.set(20, 20); return t }, [])
  const dirtTex  = useMemo(() => { const t = makeDirtTexture();  t.repeat.set(1.6, 13); return t }, [])

  // ── Ground (displaced hilltop) ──
  const groundGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(340, 340, 150, 150)
    g.rotateX(-Math.PI / 2)
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) p.setY(i, groundHeight(p.getX(i), p.getZ(i)))
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
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i)
      const z = p.getZ(i) + cz
      p.setZ(i, z)
      p.setY(i, groundHeight(x, z) + 0.04)
    }
    g.computeVertexNormals()
    return g
  }, [])

  return (
    <group>
      {/* dim moonlight to give the ground form over the flat ambient */}
      <directionalLight position={[-30, 40, 25]} intensity={1.4} color="#9DB4D8" />

      <mesh geometry={groundGeo} receiveShadow>
        <meshStandardMaterial map={grassTex} bumpMap={grassTex} bumpScale={0.5} roughness={1} metalness={0} />
      </mesh>
      <mesh geometry={pathGeo}>
        <meshStandardMaterial map={dirtTex} bumpMap={dirtTex} bumpScale={0.6} roughness={1} metalness={0} />
      </mesh>
      <primitive object={rocks} />
      <primitive object={grass} />
    </group>
  )
}
