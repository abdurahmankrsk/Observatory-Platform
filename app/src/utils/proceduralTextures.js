'use client'

/**
 * Procedural texture generation utilities.
 * Creates THREE.DataTexture instances for use in custom shaders.
 * All textures are generated on the CPU and uploaded to GPU once.
 */
import * as THREE from 'three'

/**
 * Generate a 2D noise texture using a simple gradient noise algorithm.
 * Used as a base for planet terrain variation.
 *
 * @param {number} size - Texture size (power of 2)
 * @param {number} seed - Seed for variation
 * @returns {THREE.DataTexture}
 */
export function generateNoiseTexture(size = 256, seed = 42) {
  const data = new Uint8Array(size * size * 4)

  // Simple gradient noise
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4
      const val = Math.floor(valuNoise(x / size, y / size, seed) * 255)
      data[idx + 0] = val
      data[idx + 1] = val
      data[idx + 2] = val
      data[idx + 3] = 255
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.needsUpdate = true
  return texture
}

/**
 * Simple value noise (no external dependency needed in utils).
 */
function valuNoise(x, y, seed) {
  const hash = (n) => {
    let h = n * 12.9898 + seed * 78.233
    h = Math.sin(h) * 43758.5453
    return h - Math.floor(h)
  }

  const ix = Math.floor(x * 256)
  const iy = Math.floor(y * 256)
  const fx = (x * 256) - ix
  const fy = (y * 256) - iy

  // Smooth interpolation (smoothstep)
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)

  const a = hash(ix + iy * 256)
  const b = hash(ix + 1 + iy * 256)
  const c = hash(ix + (iy + 1) * 256)
  const d = hash(ix + 1 + (iy + 1) * 256)

  return a + (b - a) * ux + (c - a) * uy + (d - a + a - b - c + b + c - a) * ux * uy
}

/**
 * Generate a cloud opacity texture — white patches on transparent background.
 *
 * @param {number} size - Texture size
 * @param {number} coverage - 0 to 1 cloud coverage
 * @returns {THREE.DataTexture}
 */
export function generateCloudTexture(size = 256, coverage = 0.5) {
  const data = new Uint8Array(size * size * 4)
  const threshold = 1 - coverage

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4

      // Multi-octave noise for natural cloud patterns
      let v = 0
      let amp = 0.5
      let freq = 1.0
      for (let oct = 0; oct < 5; oct++) {
        v += amp * valuNoise((x / size) * freq, (y / size) * freq, 100 + oct * 37)
        amp *= 0.5
        freq *= 2
      }

      const alpha = v > threshold ? Math.pow((v - threshold) / coverage, 0.5) : 0
      data[idx + 0] = 255
      data[idx + 1] = 255
      data[idx + 2] = 255
      data[idx + 3] = Math.floor(Math.min(alpha, 1) * 200)
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.needsUpdate = true
  return texture
}

/**
 * Generate a star field texture for the skybox / background.
 * Returns a DataTexture with randomly placed stars of varying brightness.
 *
 * @param {number} size - Texture size
 * @param {number} starCount - Approximate number of stars
 * @returns {THREE.DataTexture}
 */
export function generateStarfieldTexture(size = 512, starCount = 2000) {
  const data = new Uint8Array(size * size * 4)

  // Dark background
  for (let i = 0; i < size * size * 4; i += 4) {
    data[i] = 2
    data[i + 1] = 4
    data[i + 2] = 8
    data[i + 3] = 255
  }

  // Paint stars
  for (let s = 0; s < starCount; s++) {
    const x = Math.floor(Math.random() * size)
    const y = Math.floor(Math.random() * size)
    const brightness = 100 + Math.floor(Math.random() * 155)
    // Slight color variation (blue-white spectrum)
    const r = brightness - Math.floor(Math.random() * 30)
    const g = brightness - Math.floor(Math.random() * 15)
    const b = brightness

    const idx = (y * size + x) * 4
    data[idx] = Math.min(r, 255)
    data[idx + 1] = Math.min(g, 255)
    data[idx + 2] = Math.min(b, 255)
    data[idx + 3] = 255
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  texture.needsUpdate = true
  return texture
}

/**
 * Creates a circular gradient texture for soft sprite particles.
 * Used for star flare / nebula particle sprites.
 *
 * @param {number} size - Texture size
 * @returns {THREE.DataTexture}
 */
export function generateSpriteTexture(size = 64) {
  const data = new Uint8Array(size * size * 4)
  const center = size / 2

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4
      const dx = x - center
      const dy = y - center
      const dist = Math.sqrt(dx * dx + dy * dy) / center

      const alpha = Math.max(0, 1 - dist * dist * dist)
      data[idx] = 255
      data[idx + 1] = 255
      data[idx + 2] = 255
      data[idx + 3] = Math.floor(alpha * 255)
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  texture.needsUpdate = true
  return texture
}
