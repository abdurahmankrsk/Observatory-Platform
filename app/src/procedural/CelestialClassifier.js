'use client'

/**
 * CelestialClassifier — turns a backend CelestialObject into a precise
 * CelestialType, following the priority chain mandated by the design:
 *
 *   1. Explicit fine-grained type field (object.celestialType / subtype / otype)
 *   2. Catalog classification fields (stellar spectral type, exoplanet physics)
 *   3. Description / name / alias text parsing
 *   4. Heuristic fallback from the coarse backend `type`
 *
 * The classifier NEVER decides from the name alone unless nothing else is
 * available — names are the lowest-priority signal, used only as extra text fed
 * into the description parser.
 *
 * Output: { type, planetClass, source, reasons } where `source` records which
 * rung of the priority chain produced the answer (handy for debugging + tests).
 */
import {
  CelestialType,
  PlanetClass,
  isStarRelatedSpecific,
  isGalaxyType,
  isNebulaType,
  isClusterType,
} from './CelestialType'
import { parseDescription } from './DescriptionParser'

const T = CelestialType

// ── Spectral type parsing ───────────────────────────────────────────────────

// Representative effective temperature (K) for each spectral class, at subclass
// 0 (hottest) → 9 (coolest within the class). Midpoints from the MK system.
const SPECTRAL_TEMP_RANGE = {
  O: [50000, 30000],
  B: [30000, 10000],
  A: [10000, 7500],
  F: [7500, 6000],
  G: [6000, 5200],
  K: [5200, 3700],
  M: [3700, 2400],
  L: [2400, 1300], // brown dwarf
  T: [1300, 600],  // brown dwarf
  Y: [600, 250],   // brown dwarf
}

// Canonical luminosity tokens, ordered so longer/more-specific tokens are tried
// first (e.g. 'Iab' before 'Ia' before 'I'; 'III' before 'II'; 'VI'/'IV' before
// 'V'). Matched case-insensitively against the uppercased spectral string.
const LUMINOSITY_ORDER = ['Iab', 'Ia', 'Ib', 'III', 'II', 'VI', 'IV', 'V', 'I']

/**
 * Parse a SIMBAD/Morgan-Keenan spectral type string.
 * Handles forms like "A0Va", "M1-M2 Ia", "G2V", "DA2" (white dwarf), "L5".
 * @param {string} sp
 * @returns {{ spectralClass: string|null, subclass: number, luminosity: string|null,
 *            isWhiteDwarf: boolean, isBrownDwarf: boolean, tempK: number|null }}
 */
export function parseSpectralType(sp) {
  const empty = {
    spectralClass: null, subclass: 5, luminosity: null,
    isWhiteDwarf: false, isBrownDwarf: false, tempK: null,
  }
  if (!sp || typeof sp !== 'string') return empty
  const s = sp.trim().toUpperCase()
  if (!s) return empty

  // White dwarfs: leading 'D' followed by a spectral letter (DA, DB, DO, DC, DZ, DQ…)
  if (/^D[ABOCQZXV]/.test(s) || /^D\d/.test(s) || s === 'D') {
    return { ...empty, spectralClass: 'D', isWhiteDwarf: true, tempK: 15000 }
  }

  const classMatch = s.match(/[OBAFGKMLTY]/)
  if (!classMatch) return empty
  const spectralClass = classMatch[0]

  // Subclass digit immediately after the class letter (e.g. "A0", "M1")
  const subMatch = s.slice(classMatch.index + 1).match(/^(\d(?:\.\d)?)/)
  const subclass = subMatch ? parseFloat(subMatch[1]) : 5

  // Luminosity class — longest roman-numeral token wins (Iab before Ia before I).
  // The token is matched as a standalone run of roman letters (not glued to more
  // I/V/X), so 'II' won't spuriously match inside 'III'.
  let luminosity = null
  for (const lc of LUMINOSITY_ORDER) {
    const re = new RegExp(`(?:^|[^IVX])(${lc.toUpperCase()})(?:[^IVX]|$)`)
    if (re.test(s)) { luminosity = lc; break }
  }

  const isBrownDwarf = spectralClass === 'L' || spectralClass === 'T' || spectralClass === 'Y'

  // Interpolate temperature within the class by subclass fraction.
  const range = SPECTRAL_TEMP_RANGE[spectralClass]
  let tempK = null
  if (range) {
    const [hot, cool] = range
    const frac = Math.max(0, Math.min(subclass, 9)) / 9
    tempK = Math.round(hot + (cool - hot) * frac)
  }

  return { spectralClass, subclass, luminosity, isWhiteDwarf: false, isBrownDwarf, tempK }
}

/** Is this a "hot" (blue/white) spectral class? */
const isHotClass = (c) => c === 'O' || c === 'B' || c === 'A'
/** Is this a "cool" (orange/red) spectral class? */
const isCoolClass = (c) => c === 'K' || c === 'M'

/**
 * Classify a star from its catalog data (spectral type, temperature, radius).
 * @returns {string|null} a CelestialType, or null if no stellar data is usable.
 */
export function classifyStar(object) {
  const star = object?.star || {}
  const sp = parseSpectralType(star.spectral_type)
  const tempK = star.temperature_k ?? sp.tempK
  const radiusSolar = star.radius_solar
  const lumSolar = star.luminosity_solar

  if (sp.isWhiteDwarf) return T.WhiteDwarf
  if (sp.isBrownDwarf || (tempK != null && tempK < 2200)) return T.BrownDwarf

  const c = sp.spectralClass
  const lum = sp.luminosity

  // Supergiants (luminosity class I / Ia / Iab / Ib).
  if (lum === 'I' || lum === 'Ia' || lum === 'Iab' || lum === 'Ib') {
    if (c && isCoolClass(c)) return T.RedSupergiant
    return T.BlueGiant // hot/intermediate supergiant rendered as a blue giant
  }
  // Bright giants / giants (II / III).
  if (lum === 'II' || lum === 'III') {
    if (c && (isCoolClass(c) || c === 'G')) return T.RedGiant
    if (c && isHotClass(c)) return T.BlueGiant
    return T.RedGiant
  }

  // No luminosity class — fall back to physical size if we have it. A very large
  // cool star is a giant; a very luminous hot star reads as a blue giant.
  if (radiusSolar != null) {
    if (radiusSolar > 100 && c && isCoolClass(c)) return T.RedSupergiant
    if (radiusSolar > 10 && c && isCoolClass(c)) return T.RedGiant
    if (radiusSolar > 6 && c && isHotClass(c)) return T.BlueGiant
  }
  if (lumSolar != null && lumSolar > 10000 && c && isHotClass(c)) return T.BlueGiant

  // Otherwise an ordinary main-sequence star (any color — color comes from temp).
  if (c || tempK != null) return T.MainSequenceStar
  return null
}

// ── Exoplanet / planet sub-classification ───────────────────────────────────

/**
 * Map exoplanet physical parameters to a PlanetClass via the design heuristics:
 *   temp > 1500K → lava;  radius ≥ 6R⊕ → gas giant;  eq.temp < 180K → icy; etc.
 * @returns {string} a PlanetClass value.
 */
export function classifyPlanetClass(object) {
  const ex = object?.exoplanet || {}
  const r = ex.radius_earth
  const m = ex.mass_earth
  const teq = ex.equilibrium_temp_k
  // Density relative to Earth (= m / r³ when both known). >1 ⇒ rockier than Earth.
  const density = m != null && r != null && r > 0 ? m / (r * r * r) : null

  // When we lack physical numbers (true for solar-system bodies), the description
  // text is the best signal — e.g. "a banded gas giant", "an ice giant", "the
  // Red Planet". This runs first so curated bodies get the right class.
  if (r == null && teq == null) {
    const t = [object?.name, object?.description, object?.fun_fact].filter(Boolean).join(' ').toLowerCase()
    if (/\bgas giant\b/.test(t)) return PlanetClass.GasGiant
    if (/\bice giant\b/.test(t)) return PlanetClass.IceGiant
    if (/\blava\b|\bmolten\b|\bvolcanic\b/.test(t)) return PlanetClass.LavaWorld
    if (/\bocean world\b|\bwater world\b|\bocean\b/.test(t)) return PlanetClass.OceanWorld
    if (/\bred planet\b|\bdesert\b|\barid\b/.test(t)) return PlanetClass.DesertWorld
    if (/\bice\b|\bicy\b|\bfrozen\b|\bnitrogen ice\b/.test(t)) return PlanetClass.IceWorld
  }

  // Extremely hot worlds glow regardless of size.
  if (teq != null && teq > 1500) return PlanetClass.LavaWorld

  // Size-driven giants.
  if (r != null) {
    if (r >= 6) return PlanetClass.GasGiant
    if (r >= 3.5) return teq != null && teq < 350 ? PlanetClass.IceGiant : PlanetClass.GasGiant
    if (r >= 2) return teq != null && teq < 300 ? PlanetClass.MiniNeptune : PlanetClass.SuperEarth
  }

  // Small / rocky family — distinguish by temperature.
  if (teq != null) {
    if (teq < 180) return PlanetClass.IceWorld
    if (teq > 800) return PlanetClass.LavaWorld
    if (teq > 400) return PlanetClass.DesertWorld
    if (teq >= 200 && teq <= 330) {
      // Habitable zone: dense rocky → ocean/earthlike, lighter → terrestrial.
      return density != null && density >= 0.7 ? PlanetClass.OceanWorld : PlanetClass.TerrestrialEarthlike
    }
  }

  // High density with no other signal ⇒ rocky.
  if (density != null && density >= 1) return PlanetClass.RockyPlanet
  return PlanetClass.RockyPlanet
}

// ── otype mapping (for forward-compat if the backend ever forwards otype) ─────
const OTYPE_FINE = {
  Psr: T.Pulsar, pulsar: T.Pulsar,
  'N*': T.NeutronStar, N: T.NeutronStar, NS: T.NeutronStar,
  bH: T.BlackHole, BH: T.BlackHole,
  SNR: T.SupernovaRemnant, 'SR?': T.SupernovaRemnant,
  PN: T.PlanetaryNebula, 'PN?': T.PlanetaryNebula,
  HII: T.EmissionNebula, GNe: T.EmissionNebula, BNe: T.EmissionNebula, EmO: T.EmissionNebula,
  RNe: T.ReflectionNebula,
  DNe: T.DarkNebula, MoC: T.DarkNebula,
  GlC: T.GlobularCluster, OpC: T.OpenCluster, 'Cl*': T.OpenCluster,
  QSO: T.Quasar, AGN: T.Quasar, Bla: T.Quasar, BLL: T.Quasar,
  WD: T.WhiteDwarf, 'WD*': T.WhiteDwarf,
  BD: T.BrownDwarf, 'BD*': T.BrownDwarf,
  YSO: T.Protostar, 'Y*O': T.Protostar, TTau: T.Protostar,
  '**': T.BinaryStar, SB: T.BinaryStar,
  G: T.Galaxy, GiG: T.Galaxy, GiC: T.Galaxy,
}
function mapOtype(otype) {
  if (!otype) return null
  return OTYPE_FINE[String(otype).trim()] ?? null
}

// ── Explicit field normalisation ────────────────────────────────────────────
function normalizeExplicit(value) {
  if (!value) return null
  const v = String(value).trim()
  // Accept either an exact CelestialType value or a case-insensitive match.
  if (CelestialType[v]) return CelestialType[v]
  const found = Object.values(CelestialType).find(
    (t) => t.toLowerCase() === v.toLowerCase().replace(/[\s_-]/g, '')
  )
  return found ?? null
}

// ── Search text assembly ────────────────────────────────────────────────────
function buildSearchText(object) {
  const aliases = Array.isArray(object?.aliases) ? object.aliases.join(' ') : (object?.aliases || '')
  return [object?.name, object?.description, object?.fun_fact, aliases]
    .filter(Boolean)
    .join('  ')
}

/**
 * Main entry point — classify a backend CelestialObject.
 * @param {object} object
 * @returns {{ type: string, planetClass: string|null, source: string, reasons: string[] }}
 */
export function classify(object) {
  const reasons = []
  if (!object) return { type: T.Unknown, planetClass: null, source: 'empty', reasons }

  const coarse = object.type
  const text = buildSearchText(object)
  const fromDesc = parseDescription(text)

  // (1) Explicit fine-grained type from the payload always wins.
  const explicit = normalizeExplicit(object.celestialType || object.celestial_type || object.subtype)
  if (explicit) {
    return { type: explicit, planetClass: explicit === T.Exoplanet || explicit === T.Planet ? classifyPlanetClass(object) : null, source: 'explicit', reasons: ['explicit field'] }
  }

  // (2a) Forwarded SIMBAD otype, if present.
  const fromOtype = mapOtype(object.otype || object.simbad_otype)
  if (fromOtype) {
    reasons.push(`otype=${object.otype || object.simbad_otype}`)
    return { type: fromOtype, planetClass: null, source: 'otype', reasons }
  }

  // (2b)+(3) Resolve within the coarse bucket the backend gave us, letting a
  // specific description override a generic spectral/coarse fallback.
  switch (coarse) {
    case 'star': {
      const fromSpectral = classifyStar(object)
      if (fromDesc && isStarRelatedSpecific(fromDesc)) {
        reasons.push('description (specific stellar phrase)')
        return { type: fromDesc, planetClass: null, source: 'description', reasons }
      }
      if (fromSpectral) {
        reasons.push(`spectral=${object.star?.spectral_type ?? object.star?.temperature_k ?? '?'}`)
        return { type: fromSpectral, planetClass: null, source: 'spectral', reasons }
      }
      if (fromDesc) {
        reasons.push('description')
        return { type: fromDesc, planetClass: null, source: 'description', reasons }
      }
      return { type: T.MainSequenceStar, planetClass: null, source: 'fallback', reasons: ['coarse=star'] }
    }

    case 'nebula': {
      // The backend buckets clusters + SNRs into "nebula", so trust a specific
      // description here. Crab Nebula → SupernovaRemnant, Pleiades → OpenCluster.
      if (fromDesc && (isNebulaType(fromDesc) || isClusterType(fromDesc) || fromDesc === T.SupernovaRemnant)) {
        reasons.push('description (nebula/cluster/SNR phrase)')
        return { type: fromDesc, planetClass: null, source: 'description', reasons }
      }
      if (fromDesc) {
        reasons.push('description')
        return { type: fromDesc, planetClass: null, source: 'description', reasons }
      }
      return { type: T.EmissionNebula, planetClass: null, source: 'fallback', reasons: ['coarse=nebula'] }
    }

    case 'galaxy': {
      if (fromDesc && (isGalaxyType(fromDesc) || fromDesc === T.Quasar)) {
        reasons.push('description (galaxy/quasar phrase)')
        return { type: fromDesc, planetClass: null, source: 'description', reasons }
      }
      return { type: T.SpiralGalaxy, planetClass: null, source: 'fallback', reasons: ['coarse=galaxy'] }
    }

    case 'blackhole':
    case 'black_hole':
      return { type: T.BlackHole, planetClass: null, source: 'fields', reasons: ['coarse=blackhole'] }

    case 'exoplanet':
      return { type: T.Exoplanet, planetClass: classifyPlanetClass(object), source: 'fields', reasons: ['coarse=exoplanet'] }

    case 'planet':
      return { type: T.Planet, planetClass: classifyPlanetClass(object), source: 'fields', reasons: ['coarse=planet'] }

    case 'moon':
      return { type: T.Moon, planetClass: classifyPlanetClass(object), source: 'fields', reasons: ['coarse=moon'] }

    case 'asteroid':
      return { type: T.Asteroid, planetClass: null, source: 'fields', reasons: ['coarse=asteroid'] }

    case 'comet':
      return { type: T.Comet, planetClass: null, source: 'fields', reasons: ['coarse=comet'] }

    default:
      break
  }

  // (4) No usable coarse type — rely purely on parsed text, else Unknown.
  if (fromDesc) {
    reasons.push('description (no coarse type)')
    return {
      type: fromDesc,
      planetClass: fromDesc === T.Exoplanet || fromDesc === T.Planet ? classifyPlanetClass(object) : null,
      source: 'description',
      reasons,
    }
  }
  return { type: T.Unknown, planetClass: null, source: 'unknown', reasons: ['no usable signal'] }
}
