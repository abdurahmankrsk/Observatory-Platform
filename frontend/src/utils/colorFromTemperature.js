/**
 * Blackbody radiation — converts stellar temperature (Kelvin)
 * to RGB color values using the scientific spectral classification.
 * Also handles planet equilibrium temperature coloring.
 */
import * as THREE from 'three'

/**
 * Stellar spectral class color table (Morgan-Keenan classification).
 * Based on actual blackbody emission spectra.
 *
 * @param {number} tempK - Temperature in Kelvin
 * @returns {THREE.Color} Three.js Color object
 */
export function temperatureToColor(tempK) {
  const color = new THREE.Color()

  if (tempK < 2000) {
    // L/T class — dark red / near-infrared
    color.setRGB(0.7, 0.15, 0.02)
  } else if (tempK < 3500) {
    // M class — deep red
    const t = (tempK - 2000) / 1500
    color.setRGB(1.0, 0.3 + t * 0.1, 0.05 + t * 0.05)
  } else if (tempK < 5000) {
    // K class — orange
    const t = (tempK - 3500) / 1500
    color.setRGB(1.0, 0.5 + t * 0.2, 0.15 + t * 0.2)
  } else if (tempK < 6000) {
    // G class — yellow (like our Sun, ~5778K)
    const t = (tempK - 5000) / 1000
    color.setRGB(1.0, 0.85 + t * 0.1, 0.55 + t * 0.25)
  } else if (tempK < 7500) {
    // F class — yellow-white
    const t = (tempK - 6000) / 1500
    color.setRGB(1.0, 0.97, 0.85 + t * 0.1)
  } else if (tempK < 10000) {
    // A class — white / blue-white
    const t = (tempK - 7500) / 2500
    color.setRGB(0.9 + t * 0.05, 0.92 + t * 0.05, 1.0)
  } else if (tempK < 30000) {
    // B class — blue-white
    const t = (tempK - 10000) / 20000
    color.setRGB(0.75 - t * 0.15, 0.85 - t * 0.05, 1.0)
  } else {
    // O class — deep blue / blue-violet
    color.setRGB(0.55, 0.7, 1.0)
  }

  return color
}

/**
 * Get spectral class letter from temperature.
 */
export function getSpectralClass(tempK) {
  if (tempK < 3500) return 'M'
  if (tempK < 5000) return 'K'
  if (tempK < 6000) return 'G'
  if (tempK < 7500) return 'F'
  if (tempK < 10000) return 'A'
  if (tempK < 30000) return 'B'
  return 'O'
}

/**
 * Get the corona / glow color for a star (slightly cooler than surface).
 */
export function coronaColor(tempK) {
  const base = temperatureToColor(tempK)
  // Shift slightly toward blue and brighten
  return new THREE.Color(
    Math.min(base.r * 0.9 + 0.1, 1),
    Math.min(base.g * 0.95 + 0.05, 1),
    Math.min(base.b + 0.1, 1),
  )
}

/**
 * Convert planet equilibrium temperature to a surface color.
 * Used for procedural planet shader uniforms.
 *
 * @param {number} tempK - Equilibrium temperature in K
 * @returns {{ ocean: THREE.Color, terrain: THREE.Color, ice: THREE.Color, atmosphere: THREE.Color }}
 */
export function planetTemperatureToColors(tempK) {
  if (!tempK || tempK <= 0) {
    // Default Earth-like
    return {
      ocean: new THREE.Color(0.08, 0.25, 0.55),
      terrain: new THREE.Color(0.25, 0.45, 0.18),
      ice: new THREE.Color(0.85, 0.9, 0.95),
      atmosphere: new THREE.Color(0.4, 0.65, 1.0),
    }
  }

  if (tempK > 1200) {
    // Lava world / hot Jupiter
    return {
      ocean: new THREE.Color(0.8, 0.2, 0.02),   // molten lava
      terrain: new THREE.Color(0.6, 0.1, 0.02), // dark crust
      ice: new THREE.Color(0.9, 0.5, 0.1),       // orange glow
      atmosphere: new THREE.Color(0.9, 0.4, 0.1),
    }
  }

  if (tempK > 600) {
    // Hot rocky world / Venus-like
    return {
      ocean: new THREE.Color(0.65, 0.3, 0.05),
      terrain: new THREE.Color(0.5, 0.25, 0.08),
      ice: new THREE.Color(0.7, 0.4, 0.15),
      atmosphere: new THREE.Color(0.9, 0.7, 0.3),
    }
  }

  if (tempK > 350) {
    // Warm / arid world
    return {
      ocean: new THREE.Color(0.15, 0.35, 0.6),
      terrain: new THREE.Color(0.55, 0.4, 0.2),
      ice: new THREE.Color(0.85, 0.85, 0.9),
      atmosphere: new THREE.Color(0.5, 0.7, 1.0),
    }
  }

  if (tempK > 200) {
    // Habitable zone — Earth-like
    return {
      ocean: new THREE.Color(0.08, 0.25, 0.6),
      terrain: new THREE.Color(0.2, 0.45, 0.15),
      ice: new THREE.Color(0.88, 0.93, 0.98),
      atmosphere: new THREE.Color(0.35, 0.6, 1.0),
    }
  }

  if (tempK > 100) {
    // Cold world — Mars/early Mars like
    return {
      ocean: new THREE.Color(0.55, 0.25, 0.15),
      terrain: new THREE.Color(0.45, 0.2, 0.12),
      ice: new THREE.Color(0.9, 0.92, 0.96),
      atmosphere: new THREE.Color(0.7, 0.6, 0.5),
    }
  }

  // Frozen world — ice planet
  return {
    ocean: new THREE.Color(0.6, 0.75, 0.95),
    terrain: new THREE.Color(0.5, 0.65, 0.85),
    ice: new THREE.Color(0.92, 0.96, 1.0),
    atmosphere: new THREE.Color(0.6, 0.8, 1.0),
  }
}

/**
 * Habitable zone check — returns true if planet could potentially host liquid water.
 */
export function isInHabitableZone(tempK) {
  return tempK >= 200 && tempK <= 350
}
