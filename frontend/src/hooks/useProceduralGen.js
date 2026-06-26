/**
 * useProceduralGen — Generates deterministic visual parameters for celestial objects.
 * Given an object's data, returns the full set of shader uniforms and geometry params
 * needed to procedurally render it in the 3D scene.
 */
import { useMemo } from 'react'
import { planetTemperatureToColors } from '../utils/colorFromTemperature'
import { temperatureToColor, coronaColor } from '../utils/colorFromTemperature'
import { computeSceneRadius } from '../utils/astronomyMath'

/**
 * Hash a string to a stable float in [0, 1].
 * Used for deterministic randomness based on object name.
 */
function hashString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return (Math.abs(hash) % 1000) / 1000
}

/**
 * Generate all procedural parameters for a planet or exoplanet.
 */
function genPlanetParams(object) {
  const seed = hashString(object.name)
  const tempK = object.exoplanet?.equilibrium_temp_k ?? 288
  const colors = planetTemperatureToColors(tempK)
  const radius = computeSceneRadius(object)

  return {
    type: 'planet',
    radius,
    // Shader uniforms
    oceanColor: colors.ocean,
    terrainColor: colors.terrain,
    iceColor: colors.ice,
    atmosphereColor: colors.atmosphere,
    // Terrain variation
    terrainSeed: seed,
    noiseScale: 1.5 + seed * 2.5,
    roughness: 0.4 + seed * 0.4,
    // Atmosphere parameters
    hasAtmosphere: tempK > 100,
    atmosphereThickness: tempK > 200 ? 0.08 + seed * 0.04 : 0.02,
    cloudCoverage: tempK > 200 && tempK < 800 ? 0.3 + seed * 0.4 : 0.05,
    // Rotation
    rotationSpeed: 0.05 + seed * 0.2,
    rotationAxis: { x: seed * 0.3, y: 1, z: (seed - 0.5) * 0.2 },
  }
}

/**
 * Generate all procedural parameters for a star.
 */
function genStarParams(object) {
  const seed = hashString(object.name)
  const tempK = object.star?.temperature_k ?? 5778
  const surfaceColor = temperatureToColor(tempK)
  const glowColor = coronaColor(tempK)
  const radius = computeSceneRadius(object)

  return {
    type: 'star',
    radius,
    surfaceColor,
    glowColor,
    temperature: tempK,
    // Convection animation
    convectionSpeed: 0.3 + (seed * 0.4),
    convectionScale: 1.5 + seed * 2,
    // Glow intensity scales with temperature
    glowIntensity: Math.min(0.3 + (tempK / 30000) * 0.7, 1.0),
    // PointLight color and intensity
    lightColor: surfaceColor,
    lightIntensity: 1 + (tempK / 6000) * 0.5,
    // Corona particle system
    coronaParticles: 2000 + Math.floor(seed * 3000),
  }
}

/**
 * Generate all procedural parameters for an asteroid.
 */
function genAsteroidParams(object) {
  const seed = hashString(object.name)
  const sizeFactor = object.asteroid?.diameter_max_km
    ? Math.min(object.asteroid.diameter_max_km / 10, 3)
    : 0.3 + seed * 0.5

  return {
    type: 'asteroid',
    radius: sizeFactor,
    // Geometry
    detail: 3 + Math.floor(seed * 3), // IcosahedronGeometry detail
    noiseScale: 0.3 + seed * 0.5,
    noiseStrength: 0.2 + seed * 0.3,
    // Material
    roughness: 0.8 + seed * 0.15,
    metalness: 0.05 + seed * 0.1,
    // Tumbling rotation
    rotationX: (seed - 0.5) * 0.8,
    rotationY: 0.1 + seed * 0.3,
    rotationZ: (seed - 0.5) * 0.5,
    // Color: grey to brown spectrum
    color: { r: 0.35 + seed * 0.2, g: 0.28 + seed * 0.15, b: 0.22 + seed * 0.1 },
  }
}

/**
 * Generate all procedural parameters for a nebula.
 */
function genNebulaParams(object) {
  const seed = hashString(object.name)
  const nebType = Math.floor(seed * 3) // 0=emission, 1=reflection, 2=planetary

  const colorSets = [
    { primary: [0.9, 0.15, 0.2], secondary: [0.7, 0.05, 0.3], name: 'emission' },   // Red/emission
    { primary: [0.15, 0.35, 0.9], secondary: [0.05, 0.6, 0.95], name: 'reflection' }, // Blue
    { primary: [0.1, 0.85, 0.5], secondary: [0.05, 0.5, 0.9], name: 'planetary' },   // Green/planetary
  ]

  const colors = colorSets[nebType]

  return {
    type: 'nebula',
    particleCount: 60000 + Math.floor(seed * 40000),
    radius: 5 + seed * 3,
    primaryColor: colors.primary,
    secondaryColor: colors.secondary,
    nebType: colors.name,
    turbulenceSpeed: 0.02 + seed * 0.03,
    spread: 0.6 + seed * 0.4,
  }
}

/**
 * Generate all procedural parameters for a galaxy.
 */
function genGalaxyParams(object) {
  const seed = hashString(object.name)

  return {
    type: 'galaxy',
    particleCount: 100000,
    radius: 7 + seed * 3,
    spiralArms: 2 + Math.floor(seed * 3),
    armSpin: 1.2 + seed * 0.8,
    armWidth: 0.3 + seed * 0.3,
    coreColor: [1.0, 0.85, 0.5],
    diskColor: [0.55, 0.65, 0.95],
    tiltAngle: seed * Math.PI * 0.5,
  }
}

/**
 * Main hook — call with a CelestialObject, get back all render params.
 */
export function useProceduralGen(object) {
  return useMemo(() => {
    if (!object) return null

    switch (object.type) {
      case 'planet':
      case 'exoplanet':
        return genPlanetParams(object)
      case 'star':
        return genStarParams(object)
      case 'asteroid':
        return genAsteroidParams(object)
      case 'nebula':
        return genNebulaParams(object)
      case 'galaxy':
        return genGalaxyParams(object)
      default:
        return genPlanetParams(object)
    }
  }, [object?.id, object?.type])
}
