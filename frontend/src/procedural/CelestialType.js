/**
 * CelestialType — the fine-grained classification taxonomy for every object the
 * observatory can visualise, plus the routing tables that map a classified type
 * onto a concrete visual generator.
 *
 * The backend only ever sends a *coarse* `type` ('star' | 'nebula' | 'galaxy' |
 * 'planet' | 'exoplanet' | 'asteroid') because the SIMBAD service collapses its
 * rich `otype` codes into three buckets. The classifier (CelestialClassifier.js)
 * reconstructs the precise type from spectral data + description text and emits
 * one of the values below.
 */

// ── The full taxonomy ───────────────────────────────────────────────────────
// Values are equal to their keys so logs/debugging stay readable.
export const CelestialType = Object.freeze({
  Planet: 'Planet',
  Exoplanet: 'Exoplanet',
  Moon: 'Moon',
  Asteroid: 'Asteroid',
  Comet: 'Comet',

  Star: 'Star',
  MainSequenceStar: 'MainSequenceStar',
  RedGiant: 'RedGiant',
  RedSupergiant: 'RedSupergiant',
  BlueGiant: 'BlueGiant',
  WhiteDwarf: 'WhiteDwarf',
  BrownDwarf: 'BrownDwarf',
  NeutronStar: 'NeutronStar',
  Pulsar: 'Pulsar',
  Magnetar: 'Magnetar',
  BlackHole: 'BlackHole',
  Protostar: 'Protostar',

  Galaxy: 'Galaxy',
  SpiralGalaxy: 'SpiralGalaxy',
  EllipticalGalaxy: 'EllipticalGalaxy',
  IrregularGalaxy: 'IrregularGalaxy',

  Nebula: 'Nebula',
  PlanetaryNebula: 'PlanetaryNebula',
  EmissionNebula: 'EmissionNebula',
  ReflectionNebula: 'ReflectionNebula',
  DarkNebula: 'DarkNebula',

  GlobularCluster: 'GlobularCluster',
  OpenCluster: 'OpenCluster',
  SupernovaRemnant: 'SupernovaRemnant',
  Quasar: 'Quasar',
  BinaryStar: 'BinaryStar',

  Unknown: 'Unknown',
})

/**
 * PlanetClass — the visual sub-classification for (exo)planets. This is a
 * separate axis from CelestialType because a single CelestialType.Exoplanet can
 * look wildly different depending on its physical parameters.
 */
export const PlanetClass = Object.freeze({
  GasGiant: 'GasGiant',
  IceGiant: 'IceGiant',
  RockyPlanet: 'RockyPlanet',
  OceanWorld: 'OceanWorld',
  LavaWorld: 'LavaWorld',
  DesertWorld: 'DesertWorld',
  IceWorld: 'IceWorld',
  SuperEarth: 'SuperEarth',
  MiniNeptune: 'MiniNeptune',
  TerrestrialEarthlike: 'TerrestrialEarthlike',
})

/**
 * Generator — the set of concrete visual renderers. Each CelestialType maps to
 * exactly one of these so the render router (ObjectGenerator.jsx) stays a flat
 * switch.
 */
export const Generator = Object.freeze({
  Planet: 'planet',
  Star: 'star',
  BinaryStar: 'binaryStar',
  NeutronStar: 'neutronStar',
  BlackHole: 'blackHole',
  Nebula: 'nebula',
  Galaxy: 'galaxy',
  Cluster: 'cluster',
  Asteroid: 'asteroid',
  Comet: 'comet',
  Quasar: 'quasar',
  SupernovaRemnant: 'supernovaRemnant',
  Unknown: 'unknown',
})

// ── Type groupings ──────────────────────────────────────────────────────────
const STAR_TYPES = new Set([
  CelestialType.Star,
  CelestialType.MainSequenceStar,
  CelestialType.RedGiant,
  CelestialType.RedSupergiant,
  CelestialType.BlueGiant,
  CelestialType.WhiteDwarf,
  CelestialType.BrownDwarf,
  CelestialType.Protostar,
  CelestialType.BinaryStar,
])

const COMPACT_STAR_TYPES = new Set([
  CelestialType.NeutronStar,
  CelestialType.Pulsar,
  CelestialType.Magnetar,
])

const GALAXY_TYPES = new Set([
  CelestialType.Galaxy,
  CelestialType.SpiralGalaxy,
  CelestialType.EllipticalGalaxy,
  CelestialType.IrregularGalaxy,
])

const NEBULA_TYPES = new Set([
  CelestialType.Nebula,
  CelestialType.PlanetaryNebula,
  CelestialType.EmissionNebula,
  CelestialType.ReflectionNebula,
  CelestialType.DarkNebula,
])

const CLUSTER_TYPES = new Set([
  CelestialType.GlobularCluster,
  CelestialType.OpenCluster,
])

const PLANET_TYPES = new Set([
  CelestialType.Planet,
  CelestialType.Exoplanet,
  CelestialType.Moon,
])

export const isStarType = (t) => STAR_TYPES.has(t)
export const isCompactStarType = (t) => COMPACT_STAR_TYPES.has(t)
export const isGalaxyType = (t) => GALAXY_TYPES.has(t)
export const isNebulaType = (t) => NEBULA_TYPES.has(t)
export const isClusterType = (t) => CLUSTER_TYPES.has(t)
export const isPlanetType = (t) => PLANET_TYPES.has(t)

/**
 * A type is "star-related and specific" when a description match should be
 * trusted over a generic spectral-class fallback — e.g. a SIMBAD row tagged as a
 * plain star whose description says "pulsar" must become a Pulsar, not an
 * ordinary main-sequence star.
 */
export function isStarRelatedSpecific(t) {
  return (
    isCompactStarType(t) ||
    t === CelestialType.BlackHole ||
    t === CelestialType.RedGiant ||
    t === CelestialType.RedSupergiant ||
    t === CelestialType.BlueGiant ||
    t === CelestialType.WhiteDwarf ||
    t === CelestialType.BrownDwarf ||
    t === CelestialType.Protostar ||
    t === CelestialType.BinaryStar ||
    t === CelestialType.SupernovaRemnant
  )
}

// ── Type → Generator routing ────────────────────────────────────────────────
const GENERATOR_BY_TYPE = {
  [CelestialType.Planet]: Generator.Planet,
  [CelestialType.Exoplanet]: Generator.Planet,
  [CelestialType.Moon]: Generator.Planet,
  [CelestialType.Asteroid]: Generator.Asteroid,
  [CelestialType.Comet]: Generator.Comet,

  [CelestialType.Star]: Generator.Star,
  [CelestialType.MainSequenceStar]: Generator.Star,
  [CelestialType.RedGiant]: Generator.Star,
  [CelestialType.RedSupergiant]: Generator.Star,
  [CelestialType.BlueGiant]: Generator.Star,
  [CelestialType.WhiteDwarf]: Generator.Star,
  [CelestialType.BrownDwarf]: Generator.Star,
  [CelestialType.Protostar]: Generator.Star,
  [CelestialType.BinaryStar]: Generator.BinaryStar,

  [CelestialType.NeutronStar]: Generator.NeutronStar,
  [CelestialType.Pulsar]: Generator.NeutronStar,
  [CelestialType.Magnetar]: Generator.NeutronStar,

  [CelestialType.BlackHole]: Generator.BlackHole,
  [CelestialType.Quasar]: Generator.Quasar,

  [CelestialType.Galaxy]: Generator.Galaxy,
  [CelestialType.SpiralGalaxy]: Generator.Galaxy,
  [CelestialType.EllipticalGalaxy]: Generator.Galaxy,
  [CelestialType.IrregularGalaxy]: Generator.Galaxy,

  [CelestialType.Nebula]: Generator.Nebula,
  [CelestialType.PlanetaryNebula]: Generator.Nebula,
  [CelestialType.EmissionNebula]: Generator.Nebula,
  [CelestialType.ReflectionNebula]: Generator.Nebula,
  [CelestialType.DarkNebula]: Generator.Nebula,

  [CelestialType.GlobularCluster]: Generator.Cluster,
  [CelestialType.OpenCluster]: Generator.Cluster,

  [CelestialType.SupernovaRemnant]: Generator.SupernovaRemnant,

  [CelestialType.Unknown]: Generator.Unknown,
}

export function generatorForType(type) {
  return GENERATOR_BY_TYPE[type] ?? Generator.Unknown
}

/**
 * Human-readable label for UI/debug, derived from the PascalCase enum value.
 * e.g. 'RedSupergiant' → 'Red Supergiant'.
 */
export function humanLabel(type) {
  if (!type) return 'Unknown'
  return String(type).replace(/([a-z])([A-Z])/g, '$1 $2')
}
