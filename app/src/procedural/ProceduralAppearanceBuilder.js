'use client'

/**
 * ProceduralAppearanceBuilder — the bridge between *classification* and
 * *rendering*. Given a backend CelestialObject it:
 *
 *   1. classifies it into a precise CelestialType (CelestialClassifier),
 *   2. picks the visual generator that type routes to,
 *   3. produces a fully-populated ProceduralAppearanceDescriptor: every color,
 *      uniform, geometry parameter and feature flag the generator needs.
 *
 * The descriptor is deterministic — the same object always yields the same look
 * — by seeding all "random" variation from a hash of the object name.
 *
 * Descriptor shape (top-level, see the design doc's example):
 *   { type, planetClass, generator, color, glowIntensity, jets, accretionDisk,
 *     atmosphere, particleEffects, pulse, ...generator-specific params }
 */
import * as THREE from 'three'
import { classify, parseSpectralType, classifyStar } from './CelestialClassifier'
import { CelestialType, PlanetClass, generatorForType, Generator, humanLabel } from './CelestialType'
import { parseFeatures } from './DescriptionParser'
import {
  planetTemperatureToColors,
  temperatureToColor,
  coronaColor,
} from '../utils/colorFromTemperature'
import { computeSceneRadius } from '../utils/astronomyMath'

const T = CelestialType

// ── deterministic seed ──────────────────────────────────────────────────────
function hashString(str) {
  let hash = 0
  const s = String(str || 'object')
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i)
    hash |= 0
  }
  return (Math.abs(hash) % 1000) / 1000
}

const toHex = (c) => `#${c.getHexString()}`
const col = (r, g, b) => new THREE.Color(r, g, b)
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// ── PLANET / EXOPLANET ──────────────────────────────────────────────────────
// Jovian band palettes keyed by PlanetClass.
function giantPalette(planetClass, seed) {
  switch (planetClass) {
    case PlanetClass.IceGiant:
      return { a: col(0.20, 0.45, 0.85), b: col(0.10, 0.65, 0.80), atm: col(0.4, 0.7, 1.0) }
    case PlanetClass.MiniNeptune:
      return { a: col(0.25, 0.40, 0.70), b: col(0.15, 0.55, 0.75), atm: col(0.45, 0.7, 0.95) }
    default: { // GasGiant — warm Jupiter-like bands, tinted by seed
      const warm = 0.55 + seed * 0.25
      return { a: col(warm, 0.45 + seed * 0.2, 0.30), b: col(0.75, 0.6, 0.45), atm: col(0.9, 0.75, 0.55) }
    }
  }
}

// Hand-tuned appearance presets for known solar-system bodies, keyed by object
// id. These override the generic class-based look so Jupiter, Saturn, Mars, the
// Moon, Io, Europa, Titan… each read as themselves. Colours map onto the planet
// shader's slots: terran uses ocean/terrain/ice; banded giants use bandColorA/B.
const SOLAR_BODY_PRESETS = {
  mercury: { radius: 0.95, surfaceStyle: 'terran', oceanColor: col(0.28, 0.26, 0.24), terrainColor: col(0.46, 0.43, 0.39), iceColor: col(0.46, 0.43, 0.39), polarIce: false, hasAtmosphere: false, atmosphere: false, cloudCoverage: 0, noiseScale: 3.4, rotationSpeed: 0.04 },
  venus: { radius: 1.35, surfaceStyle: 'terran', oceanColor: col(0.7, 0.55, 0.25), terrainColor: col(0.82, 0.66, 0.32), iceColor: col(0.88, 0.78, 0.5), polarIce: false, atmosphereColor: col(0.96, 0.82, 0.45), hasAtmosphere: true, atmosphere: true, atmosphereThickness: 0.15, cloudCoverage: 0.92, rotationSpeed: 0.03 },
  earth: { radius: 1.4, surfaceStyle: 'terran', oceanColor: col(0.04, 0.24, 0.6), terrainColor: col(0.2, 0.45, 0.16), iceColor: col(0.92, 0.96, 1.0), atmosphereColor: col(0.35, 0.6, 1.0), hasAtmosphere: true, atmosphere: true, atmosphereThickness: 0.1, cloudCoverage: 0.5, rotationSpeed: 0.12 },
  mars: { radius: 1.2, surfaceStyle: 'terran', oceanColor: col(0.5, 0.22, 0.12), terrainColor: col(0.72, 0.36, 0.18), iceColor: col(0.95, 0.96, 1.0), atmosphereColor: col(0.85, 0.6, 0.5), hasAtmosphere: true, atmosphere: true, atmosphereThickness: 0.03, cloudCoverage: 0.05, noiseScale: 2.6, rotationSpeed: 0.11 },
  jupiter: { radius: 2.4, surfaceStyle: 'bands', bandColorA: col(0.6, 0.46, 0.32), bandColorB: col(0.88, 0.78, 0.62), atmosphereColor: col(0.9, 0.8, 0.65), hasAtmosphere: true, atmosphere: true, atmosphereThickness: 0.12, cloudCoverage: 0, hasRings: false, noiseScale: 2.6, rotationSpeed: 0.4, planetFeature: 'jupiterRedSpot' },
  saturn: { radius: 2.1, surfaceStyle: 'bands', bandColorA: col(0.8, 0.72, 0.5), bandColorB: col(0.92, 0.86, 0.66), atmosphereColor: col(0.92, 0.85, 0.62), hasAtmosphere: true, atmosphere: true, atmosphereThickness: 0.1, cloudCoverage: 0, hasRings: true, ringInner: 1.4, ringOuter: 2.5, ringColor: col(0.86, 0.79, 0.62), ringOpacity: 0.85, noiseScale: 2.4, rotationSpeed: 0.38, planetFeature: 'saturnHexagon' },
  uranus: { radius: 1.7, surfaceStyle: 'bands', bandColorA: col(0.55, 0.8, 0.82), bandColorB: col(0.68, 0.9, 0.92), atmosphereColor: col(0.6, 0.85, 0.9), hasAtmosphere: true, atmosphere: true, atmosphereThickness: 0.11, cloudCoverage: 0, hasRings: true, ringInner: 1.7, ringOuter: 1.82, ringColor: col(0.6, 0.7, 0.75), ringOpacity: 0.18, rotationSpeed: 0.28, axialTilt: 97.77 * Math.PI / 180 },
  neptune: { radius: 1.65, surfaceStyle: 'bands', bandColorA: col(0.10, 0.24, 0.75), bandColorB: col(0.12, 0.28, 0.78), atmosphereColor: col(0.15, 0.35, 0.85), hasAtmosphere: true, atmosphere: true, atmosphereThickness: 0.13, cloudCoverage: 0, hasRings: false, rotationSpeed: 0.3, noiseScale: 1.8, planetFeature: 'neptuneDarkSpot' },
  pluto: { radius: 0.8, surfaceStyle: 'terran', oceanColor: col(0.5, 0.42, 0.35), terrainColor: col(0.66, 0.56, 0.46), iceColor: col(0.8, 0.74, 0.66), polarIce: false, hasAtmosphere: false, atmosphere: false, cloudCoverage: 0, noiseScale: 2.8 },
  ceres: { radius: 0.75, surfaceStyle: 'terran', oceanColor: col(0.3, 0.28, 0.26), terrainColor: col(0.46, 0.42, 0.38), iceColor: col(0.46, 0.42, 0.38), polarIce: false, hasAtmosphere: false, atmosphere: false, cloudCoverage: 0, noiseScale: 3.2 },
  eris: { radius: 0.78, surfaceStyle: 'terran', oceanColor: col(0.7, 0.7, 0.72), terrainColor: col(0.82, 0.82, 0.85), iceColor: col(0.95, 0.96, 1.0), polarIce: false, hasAtmosphere: false, atmosphere: false, cloudCoverage: 0 },
  // ── Moons ──
  moon: { radius: 0.75, surfaceStyle: 'terran', oceanColor: col(0.2, 0.2, 0.22), terrainColor: col(0.45, 0.45, 0.47), iceColor: col(0.45, 0.45, 0.47), polarIce: false, hasAtmosphere: false, atmosphere: false, cloudCoverage: 0, noiseScale: 3.6, rotationSpeed: 0.03 },
  io: { radius: 0.8, surfaceStyle: 'terran', oceanColor: col(0.72, 0.55, 0.12), terrainColor: col(0.88, 0.74, 0.22), iceColor: col(0.6, 0.28, 0.1), polarIce: false, emissive: true, emissiveIntensity: 0.25, hasAtmosphere: false, atmosphere: false, cloudCoverage: 0, noiseScale: 2.8 },
  europa: { radius: 0.72, surfaceStyle: 'terran', oceanColor: col(0.72, 0.74, 0.8), terrainColor: col(0.86, 0.82, 0.78), iceColor: col(0.96, 0.97, 1.0), polarIce: false, hasAtmosphere: false, atmosphere: false, cloudCoverage: 0, noiseScale: 1.6 },
  ganymede: { radius: 0.85, surfaceStyle: 'terran', oceanColor: col(0.4, 0.38, 0.36), terrainColor: col(0.56, 0.51, 0.46), iceColor: col(0.56, 0.51, 0.46), polarIce: false, hasAtmosphere: false, atmosphere: false, cloudCoverage: 0, noiseScale: 2.6 },
  callisto: { radius: 0.82, surfaceStyle: 'terran', oceanColor: col(0.24, 0.22, 0.2), terrainColor: col(0.4, 0.36, 0.32), iceColor: col(0.4, 0.36, 0.32), polarIce: false, hasAtmosphere: false, atmosphere: false, cloudCoverage: 0, noiseScale: 3.4 },
  titan: { radius: 0.85, surfaceStyle: 'terran', oceanColor: col(0.5, 0.35, 0.12), terrainColor: col(0.68, 0.48, 0.18), iceColor: col(0.8, 0.62, 0.3), polarIce: false, atmosphereColor: col(0.92, 0.62, 0.22), hasAtmosphere: true, atmosphere: true, atmosphereThickness: 0.16, cloudCoverage: 0.88 },
  enceladus: { radius: 0.6, surfaceStyle: 'terran', oceanColor: col(0.85, 0.88, 0.92), terrainColor: col(0.92, 0.94, 0.98), iceColor: col(0.99, 1.0, 1.0), polarIce: false, hasAtmosphere: false, atmosphere: false, cloudCoverage: 0, noiseScale: 1.8 },
  triton: { radius: 0.7, surfaceStyle: 'terran', oceanColor: col(0.78, 0.68, 0.7), terrainColor: col(0.86, 0.78, 0.78), iceColor: col(0.96, 0.93, 0.96), polarIce: false, hasAtmosphere: false, atmosphere: false, cloudCoverage: 0, noiseScale: 2.2 },
  phobos: { radius: 0.45, surfaceStyle: 'terran', oceanColor: col(0.2, 0.18, 0.16), terrainColor: col(0.32, 0.29, 0.26), iceColor: col(0.32, 0.29, 0.26), polarIce: false, hasAtmosphere: false, atmosphere: false, cloudCoverage: 0, noiseScale: 4.0 },
  deimos: { radius: 0.4, surfaceStyle: 'terran', oceanColor: col(0.22, 0.2, 0.18), terrainColor: col(0.34, 0.31, 0.28), iceColor: col(0.34, 0.31, 0.28), polarIce: false, hasAtmosphere: false, atmosphere: false, cloudCoverage: 0, noiseScale: 3.6 },
}

function buildPlanet(object, planetClass, seed) {
  const tempK = object?.exoplanet?.equilibrium_temp_k ?? 288
  const colors = planetTemperatureToColors(tempK)
  const radius = computeSceneRadius(object)
  const name = String(object?.name || '').toLowerCase()

  // Baseline (terran) descriptor — overridden per planet class below.
  const d = {
    radius,
    surfaceStyle: 'terran', // 'terran' | 'bands' | 'lava'
    oceanColor: colors.ocean,
    terrainColor: colors.terrain,
    iceColor: colors.ice,
    atmosphereColor: colors.atmosphere,
    bandColorA: colors.terrain,
    bandColorB: colors.ocean,
    emissive: false,
    emissiveIntensity: 0.0,
    terrainSeed: seed,
    noiseScale: 1.5 + seed * 2.5,
    roughness: 0.4 + seed * 0.4,
    hasAtmosphere: tempK > 100,
    atmosphereThickness: tempK > 200 ? 0.08 + seed * 0.04 : 0.02,
    cloudCoverage: tempK > 200 && tempK < 800 ? 0.3 + seed * 0.4 : 0.05,
    rotationSpeed: 0.05 + seed * 0.2,
    rotationAxis: { x: seed * 0.3, y: 1, z: (seed - 0.5) * 0.2 },
    hasRings: false,
    ringInner: 1.4, ringOuter: 2.2, ringColor: col(0.8, 0.75, 0.65), ringOpacity: 0.5,
    atmosphere: tempK > 100,
  }

  switch (planetClass) {
    case PlanetClass.GasGiant:
    case PlanetClass.IceGiant:
    case PlanetClass.MiniNeptune: {
      const pal = giantPalette(planetClass, seed)
      d.surfaceStyle = 'bands'
      d.bandColorA = pal.a
      d.bandColorB = pal.b
      d.atmosphereColor = pal.atm
      d.hasAtmosphere = true
      d.atmosphere = true
      d.atmosphereThickness = 0.12 + seed * 0.05
      d.cloudCoverage = 0.0 // bands are painted in the surface shader, not clouds
      d.noiseScale = 2.0 + seed * 1.5
      d.rotationSpeed = 0.18 + seed * 0.25 // giants spin fast
      // Rings: always for true gas giants, sometimes for ice giants, plus by name.
      d.hasRings =
        planetClass === PlanetClass.GasGiant ||
        (planetClass === PlanetClass.IceGiant && seed > 0.45) ||
        /saturn|jupiter|neptune|uranus/.test(name)
      if (/saturn/.test(name)) { d.ringOpacity = 0.85; d.ringOuter = 2.6 }
      d.ringColor = planetClass === PlanetClass.IceGiant ? col(0.6, 0.7, 0.85) : col(0.82, 0.74, 0.6)
      break
    }
    case PlanetClass.LavaWorld: {
      d.surfaceStyle = 'lava'
      d.emissive = true
      d.emissiveIntensity = 1.0
      d.oceanColor = col(0.95, 0.35, 0.05)  // molten channels
      d.terrainColor = col(0.18, 0.05, 0.03) // dark cooled crust
      d.iceColor = col(1.0, 0.6, 0.15)
      d.atmosphereColor = col(0.9, 0.35, 0.1)
      d.hasAtmosphere = true
      d.atmosphere = true
      d.atmosphereThickness = 0.09
      d.cloudCoverage = 0.0
      d.noiseScale = 2.5 + seed * 2.0
      break
    }
    case PlanetClass.OceanWorld:
      d.cloudCoverage = 0.5 + seed * 0.3
      d.oceanColor = col(0.05, 0.25, 0.6)
      d.atmosphereThickness = 0.1
      break
    case PlanetClass.DesertWorld:
      d.oceanColor = col(0.6, 0.4, 0.2)
      d.terrainColor = col(0.7, 0.5, 0.25)
      d.iceColor = col(0.85, 0.8, 0.7)
      d.cloudCoverage = 0.08
      break
    case PlanetClass.IceWorld:
      d.oceanColor = col(0.6, 0.75, 0.95)
      d.terrainColor = col(0.7, 0.82, 0.95)
      d.iceColor = col(0.95, 0.98, 1.0)
      d.cloudCoverage = 0.15
      break
    case PlanetClass.SuperEarth:
      d.atmosphereThickness = 0.12
      d.cloudCoverage = 0.45 + seed * 0.3
      break
    case PlanetClass.RockyPlanet:
      d.cloudCoverage = 0.05
      d.atmosphereThickness = 0.03
      d.hasAtmosphere = tempK > 150
      d.atmosphere = tempK > 150
      break
    default: // TerrestrialEarthlike — keep baseline
      break
  }

  // Known solar-system body? Its hand-tuned preset overrides the generic look.
  const preset = SOLAR_BODY_PRESETS[String(object?.id || '').toLowerCase()]
  if (preset) Object.assign(d, preset)

  return {
    generator: Generator.Planet,
    color: toHex(d.surfaceStyle === 'lava' ? d.oceanColor : (d.bandColorA || d.terrainColor)),
    glowIntensity: d.emissive ? (d.emissiveIntensity ?? 1.5) : 0.0,
    jets: false,
    accretionDisk: false,
    atmosphere: d.atmosphere,
    particleEffects: false,
    pulse: false,
    planetClass,
    equilibriumTempK: tempK,
    ...d,
  }
}

// ── STARS ───────────────────────────────────────────────────────────────────
// Per-type visual presets: [tempK default, radius multiplier, convection, corona].
function starPreset(type, object, seed) {
  const star = object?.star || {}
  const sp = parseSpectralType(star.spectral_type)
  const dataTemp = star.temperature_k ?? sp.tempK
  const base = computeSceneRadius(object)

  switch (type) {
    case T.RedSupergiant:
      return { tempK: dataTemp ?? 3500, radius: clamp(base * 2.6, 3.0, 6.0),
        convectionSpeed: 0.5, convectionScale: 1.1, coronaScale: 1.9, coronaOpacity: 0.7,
        glowBoost: 0.4, mutedSurface: 0.0 }
    case T.RedGiant:
      return { tempK: dataTemp ?? 3800, radius: clamp(base * 1.9, 2.2, 4.5),
        convectionSpeed: 0.4, convectionScale: 1.4, coronaScale: 1.6, coronaOpacity: 0.6,
        glowBoost: 0.25, mutedSurface: 0.0 }
    case T.BlueGiant:
      return { tempK: dataTemp ?? 22000, radius: clamp(base * 1.6, 1.8, 4.0),
        convectionSpeed: 0.6, convectionScale: 2.2, coronaScale: 1.7, coronaOpacity: 0.75,
        glowBoost: 0.5, mutedSurface: 0.0 }
    case T.WhiteDwarf:
      return { tempK: dataTemp ?? 14000, radius: clamp(base * 0.35, 0.25, 0.6),
        convectionSpeed: 0.2, convectionScale: 4.0, coronaScale: 1.25, coronaOpacity: 0.35,
        glowBoost: 0.1, mutedSurface: 0.0 }
    case T.BrownDwarf:
      return { tempK: dataTemp ?? 1300, radius: clamp(base * 0.6, 0.4, 1.0),
        convectionSpeed: 0.25, convectionScale: 2.5, coronaScale: 1.15, coronaOpacity: 0.12,
        glowBoost: -0.2, mutedSurface: 0.55 } // dim, reddish, cloud-banded
    case T.Protostar:
      return { tempK: dataTemp ?? 4200, radius: clamp(base * 1.4, 1.2, 3.0),
        convectionSpeed: 0.7, convectionScale: 1.8, coronaScale: 2.0, coronaOpacity: 0.8,
        glowBoost: 0.2, mutedSurface: 0.0 }
    default: // MainSequenceStar / Star / BinaryStar
      return { tempK: dataTemp ?? 5778, radius: clamp(base, 0.5, 3.0),
        convectionSpeed: 0.35, convectionScale: 1.8, coronaScale: 1.5, coronaOpacity: 0.6,
        glowBoost: 0.0, mutedSurface: 0.0 }
  }
}

function buildStar(object, type, seed) {
  const p = starPreset(type, object, seed)
  const tempK = p.tempK
  let surfaceColor = temperatureToColor(tempK)
  let glowColor = coronaColor(tempK)

  if (type === T.BrownDwarf) {
    surfaceColor = col(0.35, 0.12, 0.06) // dark reddish-brown
    glowColor = col(0.5, 0.18, 0.08)
  }

  const glowIntensity = clamp(0.3 + (tempK / 30000) * 0.7 + p.glowBoost, 0.05, 1.2)

  return {
    generator: Generator.Star,
    type,
    color: toHex(surfaceColor),
    radius: p.radius,
    surfaceColor,
    glowColor,
    temperature: tempK,
    convectionSpeed: p.convectionSpeed + seed * 0.15,
    convectionScale: p.convectionScale + seed * 0.6,
    glowIntensity,
    coronaScale: p.coronaScale,
    coronaOpacity: p.coronaOpacity,
    mutedSurface: p.mutedSurface,
    lightColor: surfaceColor,
    lightIntensity: clamp(1 + (tempK / 6000) * 0.5, 0.4, 4),
    coronaParticles: 2000 + Math.floor(seed * 3000),
    // Protostars are wreathed in collapsing dust + bipolar jets.
    jets: type === T.Protostar,
    accretionDisk: false,
    atmosphere: false,
    particleEffects: type === T.Protostar,
    pulse: false,
    binary: type === T.BinaryStar,
  }
}

// ── BINARY / MULTIPLE STAR SYSTEMS ──────────────────────────────────────────
function buildBinaryStar(object, seed) {
  const text = [object?.name, object?.description, object?.fun_fact].filter(Boolean).join(' ').toLowerCase()
  const count =
    /\b(quadruple|quaternary|four[-\s]star)\b/.test(text) ? 4 :
    /\b(triple|ternary|trinary|three[-\s]star)\b/.test(text) ? 3 : 2

  // Primary keeps the catalogued spectral type (Sirius A1V → white A star).
  const primaryType = (() => {
    const t = classifyStar(object)
    return !t || t === T.BinaryStar ? T.MainSequenceStar : t
  })()
  const primary = buildStar(object, primaryType, seed)

  const wantsWhiteDwarf = /white dwarf/.test(text)
  const stars = [primary]
  for (let i = 1; i < count; i++) {
    const cs = (seed * 0.37 * (i + 1)) % 1
    let compType, compTemp
    if (wantsWhiteDwarf && i === 1) {
      compType = T.WhiteDwarf; compTemp = 13000
    } else {
      compType = cs < 0.5 ? T.MainSequenceStar : T.RedGiant
      compTemp = 3300 + cs * 2800
    }
    const comp = buildStar({ name: `${object?.name || 'star'}-${i}`, star: { temperature_k: compTemp } }, compType, cs)
    // Shrink ordinary companions so the primary still reads as the primary.
    if (compType !== T.WhiteDwarf) comp.radius *= 0.55 + cs * 0.25
    stars.push(comp)
  }

  const maxR = Math.max(...stars.map((s) => s.radius))
  const separation = (primary.radius + maxR) * 2.6 + seed
  return {
    generator: Generator.BinaryStar,
    type: T.BinaryStar,
    color: primary.color,
    stars,
    componentCount: count,
    separation,
    orbitSpeed: 0.15 + seed * 0.2,
    radius: primary.radius,
    glowIntensity: primary.glowIntensity,
    jets: false,
    accretionDisk: false,
    atmosphere: false,
    particleEffects: false,
    pulse: false,
  }
}

// ── COMPACT STARS: neutron star / pulsar / magnetar ─────────────────────────
function buildNeutronStar(object, type, seed) {
  const base = {
    generator: Generator.NeutronStar,
    type,
    color: '#b4d9ff',
    coreColor: col(0.7, 0.85, 1.0),
    radius: 0.45 + seed * 0.15, // neutron stars are tiny but we keep them visible
    glowColor: col(0.6, 0.8, 1.0),
    glowIntensity: 2.5,
    rotationSpeed: 3.0 + seed * 4.0,
    beams: false,
    beamColor: col(0.75, 0.88, 1.0),
    jets: false,
    pulse: false,
    pulseSpeed: 6.0,
    magneticField: false,
    magneticArcs: false,
    particleEffects: true,
    accretionDisk: false,
    atmosphere: false,
  }

  switch (type) {
    case T.Pulsar:
      return { ...base, beams: true, jets: true, pulse: true, pulseSpeed: 8.0 + seed * 6.0,
        magneticField: true, glowIntensity: 2.8, rotationSpeed: 5.0 + seed * 6.0 }
    case T.Magnetar:
      return { ...base, magneticField: true, magneticArcs: true, beams: true,
        glowIntensity: 3.2, color: '#cfe0ff', coreColor: col(0.85, 0.9, 1.0),
        pulse: true, pulseSpeed: 3.0 + seed * 3.0 }
    default: // NeutronStar
      return { ...base, magneticField: true, glowIntensity: 2.2 }
  }
}

// ── BLACK HOLE ──────────────────────────────────────────────────────────────
function buildBlackHole(object, seed, features) {
  // "Bright accretion disk if data suggests active accretion" — otherwise a
  // dimmer, cooler disk so quiescent holes still read but don't blaze.
  const active = features.accretionDisk || features.jets
  return {
    generator: Generator.BlackHole,
    type: T.BlackHole,
    color: '#000000',
    radius: 1.0 + seed * 0.4, // event horizon radius
    accretionDisk: true,
    accretionActive: active,
    diskInnerColor: col(1.0, 0.95, 0.8),
    diskMidColor: col(1.0, 0.55, 0.2),
    diskOuterColor: col(0.7, 0.15, 0.35),
    // Kept moderate: a very bright additive inner lip next to the pure-black
    // horizon is the high-contrast edge bloom turns into flicker/flashes. The
    // disk shader also hard-clamps its output, so this mostly sets the mid tone.
    diskBrightness: active ? 1.2 : 0.85,
    diskInner: 1.6 + seed * 0.2,
    diskOuter: 4.5 + seed * 1.5,
    diskTilt: 0.45 + seed * 0.25,
    lensing: true,
    photonRing: true,
    jets: features.jets,
    jetColor: col(0.6, 0.8, 1.0),
    jetLength: 8 + seed * 4,
    glowIntensity: 2.0,
    particleEffects: true,
    atmosphere: false,
  }
}

// ── QUASAR ──────────────────────────────────────────────────────────────────
function buildQuasar(object, seed) {
  return {
    generator: Generator.Quasar,
    type: T.Quasar,
    color: '#bcd4ff',
    radius: 0.8 + seed * 0.3,
    accretionDisk: true,
    diskInnerColor: col(0.85, 0.92, 1.0),
    diskMidColor: col(0.6, 0.7, 1.0),
    diskOuterColor: col(0.4, 0.3, 0.8),
    diskBrightness: 2.4,
    diskInner: 1.2 + seed * 0.2,
    diskOuter: 5.0 + seed * 1.5,
    diskTilt: 0.5 + seed * 0.2,
    jets: true,
    jetColor: col(0.7, 0.85, 1.0),
    jetLength: 16 + seed * 6,
    glowIntensity: 3.0,
    particleEffects: true,
    hostGlow: true, // faint surrounding galaxy
    hostColor: col(0.5, 0.55, 0.8),
    atmosphere: false,
  }
}

// ── SUPERNOVA REMNANT ───────────────────────────────────────────────────────
function buildSupernovaRemnant(object, seed, features) {
  const text = [object?.name, object?.description, object?.fun_fact].filter(Boolean).join(' ').toLowerCase()
  
  if (object?.id === 'veil_nebula') {
    return {
      generator: Generator.SupernovaRemnant,
      type: T.SupernovaRemnant,
      color: '#7fd4c0',
      radius: 7.5,
      shellThickness: 0.3,
      particleCount: 120000,
      filaments: true,
      expansionSpeed: 0.02,
      oxygenColor: col(0.0, 0.95, 1.0),   // vivid cyan
      hydrogenColor: col(1.0, 0.1, 0.5),  // vivid pink/magenta
      sulfurColor: col(0.9, 0.2, 0.7),    // deep pink
      centralPulsar: false,
      glowIntensity: 2.0,
      particleEffects: true,
      jets: false,
      accretionDisk: false,
      atmosphere: false,
      // Shape constraints to form a long wispy tunnel/ribbon
      isTunnel: true,
    }
  }

  return {
    generator: Generator.SupernovaRemnant,
    type: T.SupernovaRemnant,
    color: '#7fd4c0',
    radius: 5.5 + seed * 2.0,
    shellThickness: 0.18 + seed * 0.1,
    particleCount: 45000 + Math.floor(seed * 25000),
    filaments: true,
    expansionSpeed: 0.04 + seed * 0.03,
    oxygenColor: col(0.2, 0.85, 0.75),   // [O III] teal
    hydrogenColor: col(0.95, 0.2, 0.3),  // Hα red
    sulfurColor: col(1.0, 0.55, 0.2),    // [S II] orange
    // The Crab is an SNR with a central pulsar — keep one if the blurb says so.
    centralPulsar: features.jets || /pulsar|neutron/.test(text),
    glowIntensity: 1.5,
    particleEffects: true,
    jets: false,
    accretionDisk: false,
    atmosphere: false,
  }
}

// ── GALAXIES ────────────────────────────────────────────────────────────────
function buildGalaxy(object, type, seed) {
  const galaxyClass =
    type === T.EllipticalGalaxy ? 'elliptical' :
    type === T.IrregularGalaxy ? 'irregular' : 'spiral'

  return {
    generator: Generator.Galaxy,
    type,
    galaxyClass,
    color: '#9fb4ff',
    particleCount: galaxyClass === 'irregular' ? 70000 : 90000,
    radius: 7 + seed * 3,
    spiralArms: 2 + Math.floor(seed * 3),
    armSpin: 1.2 + seed * 0.8,
    armWidth: 0.3 + seed * 0.3,
    coreColor: [1.0, 0.85, 0.5],
    diskColor: [0.55, 0.65, 0.95],
    tiltAngle: seed * Math.PI * 0.5,
    dustLanes: galaxyClass === 'spiral',
    glowIntensity: 1.0,
    particleEffects: true,
    jets: false,
    accretionDisk: false,
    atmosphere: false,
  }
}

// ── STAR CLUSTERS ───────────────────────────────────────────────────────────
function buildCluster(object, type, seed) {
  const isGlobular = type === T.GlobularCluster
  return {
    generator: Generator.Cluster,
    type,
    clusterClass: isGlobular ? 'globular' : 'open',
    color: isGlobular ? '#ffd9a8' : '#bcd0ff',
    radius: isGlobular ? 4 + seed * 1.5 : 5 + seed * 2,
    starCount: isGlobular ? 40000 + Math.floor(seed * 20000) : 1200 + Math.floor(seed * 1500),
    distribution: isGlobular ? 'spherical' : 'loose',
    // Globulars are old & red; open clusters are young & blue-white.
    coreTempK: isGlobular ? 4500 : 12000,
    glowIntensity: 1.0,
    particleEffects: true,
    jets: false,
    accretionDisk: false,
    atmosphere: false,
  }
}

// ── ASTEROIDS / COMETS ──────────────────────────────────────────────────────
function buildAsteroid(object, seed, isComet) {
  const sizeFactor = object?.asteroid?.diameter_max_km
    ? clamp(object.asteroid.diameter_max_km / 10, 0.2, 3)
    : 0.3 + seed * 0.5
  return {
    generator: isComet ? Generator.Comet : Generator.Asteroid,
    type: isComet ? T.Comet : T.Asteroid,
    color: '#5a4d3f',
    radius: sizeFactor,
    detail: 3 + Math.floor(seed * 3),
    noiseScale: 0.3 + seed * 0.5,
    noiseStrength: 0.2 + seed * 0.3,
    roughness: 0.8 + seed * 0.15,
    metalness: 0.05 + seed * 0.1,
    rotationX: (seed - 0.5) * 0.8,
    rotationY: 0.1 + seed * 0.3,
    rotationZ: (seed - 0.5) * 0.5,
    surfaceColor: { r: 0.35 + seed * 0.2, g: 0.28 + seed * 0.15, b: 0.22 + seed * 0.1 },
    hasTail: isComet,
    tailColor: col(0.6, 0.8, 1.0),
    tailLength: 6 + seed * 4,
    particleEffects: isComet,
    jets: false,
    accretionDisk: false,
    atmosphere: false,
  }
}

// ── NEBULAE ─────────────────────────────────────────────────────────────────
function nebulaStyleFor(type) {
  switch (type) {
    case T.PlanetaryNebula: return 'planetary'
    case T.ReflectionNebula: return 'reflection'
    case T.DarkNebula: return 'dark'
    case T.EmissionNebula: return 'emission'
    default: return 'emission'
  }
}

const NEBULA_COLORS = {
  emission: { primary: [0.95, 0.25, 0.35], secondary: [0.7, 0.1, 0.45] },   // ionised hydrogen pink/red
  reflection: { primary: [0.25, 0.45, 0.95], secondary: [0.1, 0.6, 0.95] }, // scattered blue
  planetary: { primary: [0.15, 0.85, 0.7], secondary: [0.3, 0.45, 0.95] },  // teal/blue shell
  dark: { primary: [0.24, 0.16, 0.13], secondary: [0.34, 0.22, 0.16] },     // dusty brown, occludes stars
}

function buildNebula(object, type, seed) {
  const style = nebulaStyleFor(type)
  const c = NEBULA_COLORS[style]
  return {
    generator: Generator.Nebula,
    type,
    nebulaStyle: style,
    nebType: style, // legacy field name kept for the existing Nebula component
    color: toHex(col(...c.primary)),
    particleCount: 60000 + Math.floor(seed * 40000),
    radius: 5 + seed * 3,
    primaryColor: c.primary,
    secondaryColor: c.secondary,
    turbulenceSpeed: 0.02 + seed * 0.03,
    spread: 0.6 + seed * 0.4,
    expanding: style === 'planetary',
    shellThickness: 0.25 + seed * 0.15,
    absorbing: style === 'dark',
    glowIntensity: style === 'dark' ? 0.2 : 1.0,
    particleEffects: true,
    jets: false,
    accretionDisk: false,
    atmosphere: false,
  }
}

// ── camera framing ──────────────────────────────────────────────────────────
// The largest visual extent of a generated object, used by the scene to size the
// orbit-camera min/max distance so every object type frames sensibly.
function computeBoundingRadius(generator, s) {
  switch (generator) {
    case Generator.Planet:
      return (s.radius || 1) * (s.hasRings ? (s.ringOuter || 2.2) + 0.3 : 1.15)
    case Generator.Star:
      return (s.radius || 1) * Math.max(s.coronaScale || 1.5, 1.6)
    case Generator.BinaryStar:
      return (s.separation || 4) + (s.radius || 1) * 1.6
    case Generator.NeutronStar:
      return Math.max((s.radius || 0.5) * 4, 3)
    case Generator.BlackHole:
      return Math.max((s.diskOuter || 4.5) * 1.25, s.jets ? (s.jetLength || 8) * 0.7 : 0)
    case Generator.Quasar:
      return Math.max((s.diskOuter || 5) * 2.0, (s.jetLength || 16) * 0.7)
    case Generator.SupernovaRemnant:
      return (s.radius || 5.5) * 1.15
    case Generator.Galaxy:
      return s.radius || 7
    case Generator.Nebula:
      return (s.radius || 6) * 1.15
    case Generator.Cluster:
      return (s.radius || 4) * 1.1
    case Generator.Asteroid:
      return (s.radius || 0.5) * 1.6
    case Generator.Comet:
      return Math.max((s.radius || 0.5) * 2, (s.tailLength || 8) * 0.6)
    default:
      return (s.radius || 1.2) * 1.6
  }
}

// ── UNKNOWN ─────────────────────────────────────────────────────────────────
function buildUnknown(object) {
  return {
    generator: Generator.Unknown,
    type: T.Unknown,
    color: '#8892a0',
    radius: 1.2,
    message: 'No accurate visualization available.',
    glowIntensity: 0.2,
    particleEffects: false,
    jets: false,
    accretionDisk: false,
    atmosphere: false,
  }
}

/**
 * Build the full ProceduralAppearanceDescriptor for a celestial object.
 * @param {object} object — backend CelestialObject (coarse-typed)
 * @returns {object|null} descriptor, or null when no object is supplied.
 */
export function buildAppearance(object) {
  if (!object) return null

  const { type, planetClass, source, reasons } = classify(object)
  const seed = hashString(object.name || object.id)
  const features = parseFeatures(
    [object.name, object.description, object.fun_fact].filter(Boolean).join(' ')
  )
  const generator = generatorForType(type)

  let specific
  switch (generator) {
    case Generator.Planet:
      specific = buildPlanet(object, planetClass || PlanetClass.TerrestrialEarthlike, seed)
      break
    case Generator.Star:
      specific = buildStar(object, type, seed)
      break
    case Generator.BinaryStar:
      specific = buildBinaryStar(object, seed)
      break
    case Generator.NeutronStar:
      specific = buildNeutronStar(object, type, seed)
      break
    case Generator.BlackHole:
      specific = buildBlackHole(object, seed, features)
      break
    case Generator.Quasar:
      specific = buildQuasar(object, seed)
      break
    case Generator.SupernovaRemnant:
      specific = buildSupernovaRemnant(object, seed, features)
      break
    case Generator.Galaxy:
      specific = buildGalaxy(object, type, seed)
      break
    case Generator.Nebula:
      specific = buildNebula(object, type, seed)
      break
    case Generator.Cluster:
      specific = buildCluster(object, type, seed)
      break
    case Generator.Asteroid:
      specific = buildAsteroid(object, seed, false)
      break
    case Generator.Comet:
      specific = buildAsteroid(object, seed, true)
      break
    default:
      specific = buildUnknown(object)
      break
  }

  return {
    // ── classification metadata ──
    celestialType: type,
    typeLabel: humanLabel(type),
    planetClass: planetClass || specific.planetClass || null,
    classificationSource: source,
    classificationReasons: reasons,
    seed,
    features,
    boundingRadius: computeBoundingRadius(generator, specific),
    // ── generator-specific appearance ──
    ...specific,
  }
}

export default buildAppearance
